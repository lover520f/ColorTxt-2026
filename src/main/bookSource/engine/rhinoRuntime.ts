import vm from "node:vm";
import type { BookSourceRecord } from "@shared/bookSource/types";
import type { JsExtensionHost } from "./jsExtensions";
import {
  inlineBookSourceCommentEvals,
  prepareLegadoAsyncJs,
  prepareLegadoJs,
} from "./legadoAsyncJs";
import {
  wrapLegadoBookForJs,
  wrapLegadoChapterForJs,
  type LegadoVariableSync,
} from "./legadoRuleEntity";
import { createJavaImporter, createOrgPackage, createPackagesStub } from "./legadoJavaShims";
import { runInBookSourceJsScope } from "./sharedJsScope";
import {
  BOOK_SOURCE_JS_TIMEOUT_MS,
  raceWithJsTimeout,
  runWithJsEvalDeadline,
  runWithJsEvalDeadlineAsync,
  toBookSourceJsTimeoutError,
} from "./bookSourceJsTimeout";

export type JsEvalContext = {
  source?: BookSourceRecord;
  book?: Record<string, unknown>;
  chapter?: Record<string, unknown>;
  result?: unknown;
  /** Legado evalJS：src 为规则页正文，result 为链式上一段输出 */
  src?: unknown;
  baseUrl?: string;
  key?: string;
  page?: number;
  host: JsExtensionHost;
  /** 规则 JS 中 java 绑定（AnalyzeRule / AnalyzeUrl），缺省用 host.javaBindings */
  java?: Record<string, unknown>;
  bookVariableSync?: LegadoVariableSync;
  chapterVariableSync?: LegadoVariableSync;
};

function buildVmSandbox(
  java: Record<string, unknown>,
  ctx: Omit<JsEvalContext, "host"> & { host: JsExtensionHost },
): Record<string, unknown> {
  const host = ctx.host;
  const book = wrapLegadoBookForJs(ctx.book, ctx.bookVariableSync);
  const chapter = wrapLegadoChapterForJs(ctx.chapter, ctx.chapterVariableSync);
  const result = ctx.result ?? "";
  const src = ctx.src !== undefined ? ctx.src : result;
  const sandbox: Record<string, unknown> = {
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    java,
    source: host.sourceWrapper,
    book,
    chapter,
    result,
    baseUrl: ctx.baseUrl ?? "",
    key: ctx.key ?? "",
    page: ctx.page ?? 1,
    cookie: host.cookieBindings,
    cache: host.cacheBindings,
    src,
    JavaImporter: function JavaImporter() {
      return createJavaImporter((msg) => host.log(msg));
    },
    Packages: createPackagesStub(),
    org: createOrgPackage(),
  };
  sandbox.globalThis = sandbox;
  return sandbox;
}

function shouldUseBookSourceJsScope(
  source: BookSourceRecord | undefined,
  useSharedJsScope?: boolean,
): boolean {
  if (useSharedJsScope === false) return false;
  return Boolean(source);
}

function runVmScript(code: string, sandbox: Record<string, unknown>): unknown {
  vm.createContext(sandbox);
  try {
    return vm.runInContext(code, sandbox, {
      timeout: BOOK_SOURCE_JS_TIMEOUT_MS,
    });
  } catch (e) {
    throw toBookSourceJsTimeoutError(e);
  }
}

export function evalJs(
  script: string,
  ctx: Omit<JsEvalContext, "host"> & { host?: JsExtensionHost },
  options: { useSharedJsScope?: boolean } = {},
): unknown {
  const host = ctx.host;
  if (!host) return "";
  try {
    return runWithJsEvalDeadline(() => {
      const inlined = inlineBookSourceCommentEvals(
        script,
        ctx.source?.bookSourceComment,
      );
      const body = prepareLegadoJs(inlined);
      const code = `(function(){ ${body} })()`;
      if (shouldUseBookSourceJsScope(ctx.source, options.useSharedJsScope)) {
        return runInBookSourceJsScope(ctx.source!, host, code, ctx);
      }
      const sandbox = buildVmSandbox(ctx.java ?? host.javaBindings, {
        ...ctx,
        host,
      });
      return runVmScript(code, sandbox);
    });
  } catch (e) {
    const err = toBookSourceJsTimeoutError(e);
    host.log(`JS 错误: ${err.message}`);
    return "";
  }
}

/** 支持 java.startBrowserAwait / java.ajax 等异步 Legado API（自动插入 await） */
export async function evalJsAsync(
  script: string,
  ctx: Omit<JsEvalContext, "host"> & { host?: JsExtensionHost },
  options: { legadoAsync?: boolean; useSharedJsScope?: boolean } = {},
): Promise<unknown> {
  const host = ctx.host;
  if (!host) return "";
  const legadoAsync = options.legadoAsync !== false;
  try {
    return await runWithJsEvalDeadlineAsync(async () => {
      const inlined = inlineBookSourceCommentEvals(
        script,
        ctx.source?.bookSourceComment,
      );

      if (shouldUseBookSourceJsScope(ctx.source, options.useSharedJsScope)) {
        const body = legadoAsync
          ? prepareLegadoAsyncJs(inlined)
          : prepareLegadoJs(inlined);
        const code = legadoAsync ? body : `(function(){ ${body} })()`;
        const result = runInBookSourceJsScope(ctx.source!, host, code, ctx, {
          async: legadoAsync,
        });
        if (!legadoAsync) return result;
        // sharedJsScope 异步路径已内嵌 raceWithJsTimeout
        return await (result as Promise<unknown>);
      }

      const body = legadoAsync
        ? prepareLegadoAsyncJs(inlined)
        : prepareLegadoJs(inlined);
      const sandbox = buildVmSandbox(ctx.java ?? host.javaBindings, {
        ...ctx,
        host,
      });
      // prepareLegadoAsyncJs 已是 (async () => { ... })()；同步则包 IIFE
      const code = legadoAsync ? body : `(function(){ ${body} })()`;
      const runResult = runVmScript(code, sandbox);
      if (!legadoAsync) return runResult;
      return await raceWithJsTimeout(
        Promise.resolve(runResult as Promise<unknown>),
      );
    });
  } catch (e) {
    const err = toBookSourceJsTimeoutError(e);
    host.log(`JS 错误: ${err.message}`);
    throw err;
  }
}

export function evalJsExpression(
  script: string,
  ctx: JsEvalContext,
): unknown {
  const trimmed = script.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<js>") || trimmed.includes("</js>")) {
    const inner = trimmed
      .replace(/^<js>/, "")
      .replace(/<\/js>$/, "")
      .trim();
    return evalJs(inner, ctx);
  }
  if (trimmed.startsWith("@js:") || trimmed.startsWith("@js:\n")) {
    return evalJs(trimmed.replace(/^@js:\n?/, ""), ctx);
  }
  // 交给 prepareLegadoJs 统一补 return，避免 return (return (...)) 双重包装
  return evalJs(trimmed, ctx);
}
