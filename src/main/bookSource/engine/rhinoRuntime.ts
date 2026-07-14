import type { BookSourceRecord } from "@shared/bookSource/types";
import type { JsExtensionHost } from "./jsExtensions";
import { prepareLegadoAsyncJs, prepareLegadoJs } from "./legadoAsyncJs";
import {
  wrapLegadoBookForJs,
  wrapLegadoChapterForJs,
  type LegadoVariableSync,
} from "./legadoRuleEntity";
import { createJavaImporter, createPackagesStub } from "./legadoJavaShims";
import { runInBookSourceJsScope } from "./sharedJsScope";

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

const AsyncFunction = Object.getPrototypeOf(async function () {
  /* noop */
}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

function invokeJsBindings(
  java: Record<string, unknown>,
  ctx: Omit<JsEvalContext, "host"> & { host: JsExtensionHost },
): unknown[] {
  const host = ctx.host;
  const book = wrapLegadoBookForJs(ctx.book, ctx.bookVariableSync);
  const chapter = wrapLegadoChapterForJs(ctx.chapter, ctx.chapterVariableSync);
  const result = ctx.result ?? "";
  const src = ctx.src !== undefined ? ctx.src : result;
  return [
    java,
    host.sourceWrapper,
    book,
    chapter,
    result,
    ctx.baseUrl ?? "",
    ctx.key ?? "",
    ctx.page ?? 1,
    host.cookieBindings,
    host.cacheBindings,
    src,
    function JavaImporter() {
      return createJavaImporter((msg) => host.log(msg));
    },
    createPackagesStub(),
  ];
}

function shouldUseBookSourceJsScope(
  source: BookSourceRecord | undefined,
  useSharedJsScope?: boolean,
): boolean {
  if (useSharedJsScope === false) return false;
  return Boolean(source);
}

export function evalJs(
  script: string,
  ctx: Omit<JsEvalContext, "host"> & { host?: JsExtensionHost },
  options: { useSharedJsScope?: boolean } = {},
): unknown {
  const host = ctx.host;
  if (!host) return "";
  try {
    const body = prepareLegadoJs(script);
    if (shouldUseBookSourceJsScope(ctx.source, options.useSharedJsScope)) {
      return runInBookSourceJsScope(
        ctx.source!,
        host,
        `(function(){ ${body} })()`,
        ctx,
      );
    }
    const fn = new Function(
      "java",
      "source",
      "book",
      "chapter",
      "result",
      "baseUrl",
      "key",
      "page",
      "cookie",
      "cache",
      "src",
      "JavaImporter",
      "Packages",
      `return (function(){ ${body} })();`,
    );
    return fn(...invokeJsBindings(ctx.java ?? host.javaBindings, { ...ctx, host }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    host.log(`JS 错误: ${msg}`);
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
    if (shouldUseBookSourceJsScope(ctx.source, options.useSharedJsScope)) {
      const body = legadoAsync ? prepareLegadoAsyncJs(script) : prepareLegadoJs(script);
      const code = legadoAsync ? body : `(function(){ ${body} })()`;
      const result = runInBookSourceJsScope(ctx.source!, host, code, ctx, {
        async: legadoAsync,
      });
      return legadoAsync ? await (result as Promise<unknown>) : result;
    }
    const body = legadoAsync ? prepareLegadoAsyncJs(script) : prepareLegadoJs(script);
    const fn = new AsyncFunction(
      "java",
      "source",
      "book",
      "chapter",
      "result",
      "baseUrl",
      "key",
      "page",
      "cookie",
      "cache",
      "src",
      "JavaImporter",
      "Packages",
      legadoAsync ? `return ${body};` : `return (function(){ ${body} })();`,
    );
    return await fn(...invokeJsBindings(ctx.java ?? host.javaBindings, { ...ctx, host }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    host.log(`JS 错误: ${msg}`);
    throw e;
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
