import { createHash } from "node:crypto";
import vm from "node:vm";
import type { BookSourceRecord } from "@shared/bookSource/types";
import type { JsExtensionHost } from "./jsExtensions";
import {
  fixRhinoBareArrayArrowParams,
  prepareJsLibAsyncBody,
} from "./legadoAsyncJs";
import {
  wrapLegadoBookForJs,
  wrapLegadoChapterForJs,
  type LegadoVariableSync,
} from "./legadoRuleEntity";
import { createJavaImporter, createOrgPackage, createPackagesStub } from "./legadoJavaShims";
import {
  BOOK_SOURCE_JS_TIMEOUT_MS,
  raceWithJsTimeout,
  toBookSourceJsTimeoutError,
} from "./bookSourceJsTimeout";

type SharedScopeEntry = {
  sandbox: Record<string, unknown>;
  asyncFunctionNames: string[];
};

const scopeCache = new Map<string, SharedScopeEntry>();

/** java.lang.String 等 shim / jsLib 异步预处理变更时递增，避免沿用过期 sandbox */
const JS_LIB_SHIM_VERSION = "8";

const SANDBOX_RESERVED = new Set([
  "globalThis",
  "javaImport",
  "JavaImporter",
  "Packages",
  "org",
]);

function jsLibCacheKey(jsLib: string): string {
  return createHash("md5")
    .update(jsLib)
    .update(JS_LIB_SHIM_VERSION)
    .digest("hex");
}

/**
 * Rhino/E4X 残留：`obj..prop`（Legado 可解析，Node 为 SyntaxError）。
 * 仅改代码中的标识符连写；字符串内 JSONPath `$..` / `..major` 等保持不动。
 */
export function fixRhinoDoubleDotPropertyAccess(script: string): string {
  const held: string[] = [];
  const masked = script.replace(
    /`(?:\\[\s\S]|\$\{(?:[^{}]|\{[^}]*\})*\}|[^`\\$]|\$(?!\{))*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g,
    (m) => {
      held.push(m);
      return `\0STR${held.length - 1}\0`;
    },
  );
  let fixed = masked;
  let prev = "";
  while (fixed !== prev) {
    prev = fixed;
    fixed = fixed.replace(
      /([A-Za-z_$][\w$]*)\.\.([A-Za-z_$][\w$]*)/g,
      "$1.$2",
    );
  }
  return fixed.replace(/\0STR(\d+)\0/g, (_, n) => held[Number(n)]!);
}

function prepareJsLib(script: string): {
  code: string;
  asyncFunctionNames: string[];
} {
  const normalized = fixRhinoDoubleDotPropertyAccess(
    fixRhinoBareArrayArrowParams(script.trim()),
  );
  return prepareJsLibAsyncBody(normalized);
}

function promoteJsLibGlobals(sandbox: Record<string, unknown>): void {
  const javaImport = sandbox.javaImport;
  if (javaImport && typeof javaImport === "object") {
    for (const [key, value] of Object.entries(javaImport)) {
      if (key === "importPackage" || typeof value !== "function") continue;
      sandbox[key] = value;
    }
  }
  for (const [key, value] of Object.entries(sandbox)) {
    if (SANDBOX_RESERVED.has(key) || typeof value !== "function") continue;
    if (!(key in sandbox) || sandbox[key] === value) continue;
  }
}

function createSandboxShell(log: (msg: string) => void): Record<string, unknown> {
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
    Packages: createPackagesStub(),
    org: createOrgPackage(),
    JavaImporter: function JavaImporter() {
      return createJavaImporter(log);
    },
  };
  sandbox.globalThis = sandbox;
  return sandbox;
}

function loadSharedJsLib(jsLib: string, log: (msg: string) => void): SharedScopeEntry {
  const key = jsLibCacheKey(jsLib);
  const cached = scopeCache.get(key);
  if (cached) return cached;

  const sandbox = createSandboxShell(log);
  vm.createContext(sandbox);
  let asyncFunctionNames: string[] = [];
  try {
    const prepared = prepareJsLib(jsLib);
    asyncFunctionNames = prepared.asyncFunctionNames;
    vm.runInContext(prepared.code, sandbox, {
      timeout: BOOK_SOURCE_JS_TIMEOUT_MS,
    });
    promoteJsLibGlobals(sandbox);
  } catch (e) {
    const err = toBookSourceJsTimeoutError(e);
    log(`jsLib 加载失败: ${err.message}`);
  }
  const entry = { sandbox, asyncFunctionNames };
  scopeCache.set(key, entry);
  return entry;
}

export function clearSharedJsLibCache(jsLib?: string | null): void {
  if (!jsLib?.trim()) {
    scopeCache.clear();
    return;
  }
  scopeCache.delete(jsLibCacheKey(jsLib.trim()));
}

/** 当前已加载 jsLib 中的 async 函数名（供规则脚本注入 await） */
export function getJsLibAsyncFunctionNames(
  jsLib: string | null | undefined,
): string[] {
  const text = jsLib?.trim();
  if (!text) return [];
  return scopeCache.get(jsLibCacheKey(text))?.asyncFunctionNames ?? [];
}

type RunScopeBindings = {
  java: Record<string, unknown>;
  source: Record<string, unknown>;
  book: Record<string, unknown>;
  chapter: Record<string, unknown>;
  result: unknown;
  baseUrl: string;
  key: string;
  page: number;
  cookie: Record<string, unknown>;
  cache: Record<string, unknown>;
  src: unknown;
};

function wrapLegadoMapLike(data: Record<string, string>): Record<string, unknown> & {
  get(key: string): string;
} {
  return {
    ...data,
    get(key: string) {
      return data[key] ?? "";
    },
  };
}

function coerceLegadoMap(value: unknown): Record<string, unknown> & {
  get(key: string): string;
} {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown> & { get?: unknown };
    if (typeof obj.get === "function") {
      return obj as Record<string, unknown> & { get(key: string): string };
    }
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "get") continue;
      data[k] = String(v ?? "");
    }
    return wrapLegadoMapLike(data);
  }
  return wrapLegadoMapLike({});
}

/** 规则 JS 的 result：字符串/数字等原样传入；扁平 string map 才包装；嵌套 JSON 保持结构供 JSONPath */
function coerceLegadoResult(value: unknown): unknown {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // 已有 .get 的 Map 风格对象（如 StrResponse）原样返回
    if (typeof obj.get === "function") return value;
    // API JSON（含嵌套 object/array）不可 stringify，否则 init 后 JSONPath 全失效
    const nested = Object.entries(obj).some(([k, v]) => {
      if (k === "get") return false;
      return v != null && typeof v === "object";
    });
    if (nested) return value;
    return coerceLegadoMap(value);
  }
  return value;
}

function applyBindings(
  sandbox: Record<string, unknown>,
  bindings: Partial<RunScopeBindings>,
): void {
  for (const [key, value] of Object.entries(bindings)) {
    if (value !== undefined) {
      sandbox[key] = value;
    }
  }
  sandbox.globalThis = sandbox;
}

/** 绑定已在 sandbox 上；勿用形参注入，避免与书源内 `let baseUrl` 等声明冲突（Legado/Rhino 作用域行为） */
function wrapAsyncScriptWithBindings(script: string): string {
  const trimmed = script.trim();
  if (/^\(async\s*\(\)\s*=>\s*\{[\s\S]*\}\)\(\)$/.test(trimmed)) {
    return trimmed;
  }
  return `(async () => {
${trimmed}
})()`;
}

function buildBindings(
  host: JsExtensionHost,
  ctx: {
    book?: Record<string, unknown>;
    chapter?: Record<string, unknown>;
    result?: unknown;
    src?: unknown;
    baseUrl?: string;
    key?: string;
    page?: number;
    java?: Record<string, unknown>;
    bookVariableSync?: LegadoVariableSync;
    chapterVariableSync?: LegadoVariableSync;
  },
): Partial<RunScopeBindings> {
  const book = wrapLegadoBookForJs(ctx.book, ctx.bookVariableSync);
  const chapter = wrapLegadoChapterForJs(ctx.chapter, ctx.chapterVariableSync);
  const result = coerceLegadoResult(ctx.result);
  const src = ctx.src !== undefined ? coerceLegadoResult(ctx.src) : result;
  return {
    java: ctx.java ?? host.javaBindings,
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
  };
}

function pickScopeResult(current: unknown, initial: unknown, runResult: unknown): unknown {
  if (runResult !== undefined) return runResult;
  if (current !== initial) return current;
  return runResult;
}

export function runInBookSourceJsScope(
  source: BookSourceRecord,
  host: JsExtensionHost,
  script: string,
  ctx: {
    book?: Record<string, unknown>;
    chapter?: Record<string, unknown>;
    result?: unknown;
    src?: unknown;
    baseUrl?: string;
    key?: string;
    page?: number;
    java?: Record<string, unknown>;
    bookVariableSync?: LegadoVariableSync;
    chapterVariableSync?: LegadoVariableSync;
  },
  options: { async?: boolean } = {},
): unknown {
  const jsLib = source.jsLib?.trim();
  const bindings = buildBindings(host, ctx);
  const sandbox = jsLib
    ? loadSharedJsLib(jsLib, (msg) => host.log(msg)).sandbox
    : createSandboxShell((msg) => host.log(msg));

  if (!jsLib) vm.createContext(sandbox);
  applyBindings(sandbox, bindings);

  const runScript = options.async ? wrapAsyncScriptWithBindings(script) : script;
  const initialResult = sandbox.result;

  try {
    const runResult = vm.runInContext(runScript, sandbox, {
      timeout: BOOK_SOURCE_JS_TIMEOUT_MS,
    });
    if (options.async) {
      return raceWithJsTimeout(
        Promise.resolve(runResult as Promise<unknown>).then((v) =>
          pickScopeResult(sandbox.result, initialResult, v),
        ),
      );
    }
    return pickScopeResult(sandbox.result, initialResult, runResult);
  } catch (e) {
    throw toBookSourceJsTimeoutError(e);
  }
}

export function ensureBookSourceJsLib(
  source: BookSourceRecord,
  host: JsExtensionHost,
): void {
  const jsLib = source.jsLib?.trim();
  if (!jsLib) return;
  loadSharedJsLib(jsLib, (msg) => host.log(msg));
}
