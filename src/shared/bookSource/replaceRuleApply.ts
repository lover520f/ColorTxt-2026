/**
 * 「文本替换」纯函数：渲染进程阅读展示。
 * 与「转换」（简繁/全半角）同属展示层变换，阅读路径应在转换之前调用。
 *
 * 「替换为」对齐 Legado `RegexExtensions.replace`：
 * - 普通字符串（支持 `$1` / `$&` 等正则回引用法）
 * - `@js:` 前缀：对每次匹配执行脚本，绑定 `result` = 本次匹配文本，返回值作为替换结果
 */
import {
  getValidTimeoutMillisecond,
  isReplaceRuleValid,
  type ReplaceRule,
} from "./replaceRule";

export function scopeMatches(
  haystack: string | null | undefined,
  name: string,
  origin: string,
): boolean {
  if (haystack == null || !String(haystack).trim()) return true;
  const s = String(haystack);
  return s.includes(name) || s.includes(origin);
}

export function excludeMatches(
  haystack: string | null | undefined,
  name: string,
  origin: string,
): boolean {
  if (haystack == null || !String(haystack).trim()) return false;
  const s = String(haystack);
  return s.includes(name) || s.includes(origin);
}

/** 对齐 Legado `findEnabledByContentScope` / `findEnabledByTitleScope` */
export function filterEnabledReplaceRules(
  rules: ReplaceRule[],
  bookName: string,
  bookOrigin: string,
  kind: "content" | "title",
): ReplaceRule[] {
  return rules.filter((rule) => {
    if (!rule.isEnabled) return false;
    if (kind === "content" && !rule.scopeContent) return false;
    if (kind === "title" && !rule.scopeTitle) return false;
    if (!scopeMatches(rule.scope, bookName, bookOrigin)) return false;
    if (excludeMatches(rule.excludeScope, bookName, bookOrigin)) return false;
    return true;
  });
}

/** 剥离 `@js:` 前缀（对齐 Legado `replacement.startsWith("@js:")` + substring(4)） */
export function stripReplaceJsPrefix(replacement: string): string | null {
  if (!/^@js:/i.test(replacement)) return null;
  return replacement.replace(/^@js:\s*/i, "");
}

/**
 * 让 Node/浏览器 `Function` 与 Rhino eval 一样返回脚本最终表达式值。
 * 覆盖常见多语句写法（如 `zk={…}; zk[result]`）。
 */
function ensureReplaceJsReturn(script: string): string {
  const trimmed = script.trim();
  if (!trimmed) return "return '';";

  const asExpr = `return (${trimmed.replace(/;\s*$/, "")});`;
  try {
    // eslint-disable-next-line no-new-func -- 仅语法探测
    new Function("result", asExpr);
    return asExpr;
  } catch {
    // 多语句：给末行表达式补 return
  }

  const lines = trimmed.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && !lines[i]!.trim()) i--;
  if (i < 0) return "return '';";

  const indent = lines[i]!.match(/^\s*/)?.[0] ?? "";
  const last = lines[i]!.trim().replace(/;\s*$/, "");
  if (!last || last.startsWith("return ")) return trimmed;

  // 单行多语句：`a=1; b` → `a=1; return (b);`
  const semi = last.lastIndexOf(";");
  if (semi >= 0) {
    const before = last.slice(0, semi + 1);
    const stmt = last.slice(semi + 1).trim();
    if (stmt && !stmt.startsWith("return ")) {
      lines[i] = `${indent}${before} return (${stmt});`;
      return lines.join("\n");
    }
  }

  lines[i] = `${indent}return (${last});`;
  return lines.join("\n");
}

function evalReplaceJs(script: string, result: string): string {
  const body = ensureReplaceJsReturn(script);
  // eslint-disable-next-line no-new-func -- 对齐 Legado Rhino：替换规则用户脚本
  const fn = new Function("result", body);
  const out = fn(result);
  if (out == null) return "";
  return String(out);
}

function compileReplaceRegex(pattern: string): RegExp {
  // 对齐 Java Pattern 的 Unicode 码点语义；无 `u` 时增补平面字会拆成代理对，
  // 易导致字符类异常 / 灾难性回溯（本规则含 𫔯𩠌 等即会卡住）。
  try {
    return new RegExp(pattern, "gu");
  } catch {
    return new RegExp(pattern, "g");
  }
}

function applyOneRule(text: string, rule: ReplaceRule, logs?: string[]): string {
  if (!rule.pattern) return text;
  if (!isReplaceRuleValid(rule)) {
    logs?.push(`文本替换：规则「${rule.name || rule.id}」无效，已跳过`);
    return text;
  }
  try {
    const replacement = rule.replacement ?? "";
    if (rule.isRegex) {
      // 浏览器 / Node 均无法可靠打断同步灾难回溯；timeout 字段保留兼容
      void getValidTimeoutMillisecond(rule);
      const re = compileReplaceRegex(rule.pattern);
      const jsBody = stripReplaceJsPrefix(replacement);
      if (jsBody != null) {
        // 函数回调的返回值按字面量写入（对齐 Legado Matcher.quoteReplacement）
        return text.replace(re, (match) => evalReplaceJs(jsBody, match));
      }
      return text.replace(re, replacement);
    }
    // 非正则：Legado 走字面量 String.replace，不执行 @js:
    return text.split(rule.pattern).join(replacement);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs?.push(`文本替换：规则「${rule.name || rule.id}」出错: ${msg}`);
    console.warn(`[replaceRule] 「${rule.name || rule.id}」`, e);
    return text;
  }
}

export function applyReplaceRulesToText(
  text: string,
  rules: ReplaceRule[],
  logs?: string[],
): string {
  let out = text;
  for (const rule of rules) {
    out = applyOneRule(out, rule, logs);
  }
  return out;
}

/** 正文净化：先按行 trim，再套用规则 */
export function applyContentReplaceWithRules(
  content: string,
  rules: ReplaceRule[],
  logs?: string[],
): string {
  if (!rules.length) return content;
  if (content === "null" || content == null) return content;
  const trimmed = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");
  return applyReplaceRulesToText(trimmed, rules, logs);
}

/** 章节标题净化 */
export function applyTitleReplaceWithRules(
  title: string,
  rules: ReplaceRule[],
  logs?: string[],
): string {
  if (!rules.length) return title;
  return applyReplaceRulesToText(title.replace(/\r?\n/g, ""), rules, logs);
}
