/**
 * Legado 书源 JS 在 Rhino 中同步调用 java.startBrowserAwait / java.ajax；
 * 在 Node 中须自动插入 await，并用 AsyncFunction 执行。
 *
 * Rhino 另有两类与标准 JS 不兼容的写法，须在 eval 前预处理：
 * 1. `.map([a,b]=>` — 数组解构箭头参数须写成 `.map(([a,b])=>`
 * 2. 脚本末尾表达式（如 `JSON.stringify(list)`）Rhino 会作为返回值，Node 须补 `return`
 */

/** Legado/Rhino：`.map([title,id]=>` → `.map(([title,id])=>` */
export function fixRhinoBareArrayArrowParams(script: string): string {
  return script.replace(
    /(\.[\w$]+\s*\(\s*)\[([^\]]+)\]\s*=>/g,
    "$1([$2])=>",
  );
}

function hasLegadoTopLevelStatements(script: string): boolean {
  return (
    /(?:^|\n)\s*(?:const|let|var|function|for|while|if|try|class|import|export)\b/.test(
      script,
    ) || /(?:^|\n)\s*[\w$]+\s*=\s*/.test(script)
  );
}

/** @deprecated java.getStringList/getElements 已改为同步 API，不再注入 await */
export function wrapAwaitLegadoJavaListCalls(script: string): string {
  return script;
}

/** 多行 JSON.stringify({ ... }) 等：从末尾回溯到表达式起始行（仅匹配 ()[]，避免 if { } 块误判） */
function findTrailingExpressionStartLine(lines: string[], endLineIdx: number): number {
  let depth = 0;
  for (let li = endLineIdx; li >= 0; li--) {
    const line = lines[li];
    for (let ci = line.length - 1; ci >= 0; ci--) {
      const c = line[ci];
      if (c === ")" || c === "]") depth++;
      else if (c === "(" || c === "[") {
        depth--;
        if (depth === 0 && (li < endLineIdx || ci > 0)) return li;
      }
    }
  }
  return endLineIdx;
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

function findMatchingParen(src: string, openIdx: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === "`") inTemplate = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Rhino：`with(obj){ ... finalExpr }` 的值即脚本返回值（七猫正文 AES 解密等） */
export function ensureLegadoWithBlockReturn(script: string): string {
  if (!/\bwith\s*\(/.test(script)) return script;

  let result = script;
  const withRe = /\bwith\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = withRe.exec(result))) {
    const parenOpen = m.index + m[0].length - 1;
    const parenClose = findMatchingParen(result, parenOpen);
    if (parenClose < 0) continue;

    let braceOpen = parenClose + 1;
    while (braceOpen < result.length && /\s/.test(result[braceOpen]!)) braceOpen++;
    if (result[braceOpen] !== "{") continue;

    const braceClose = findMatchingBrace(result, braceOpen);
    if (braceClose < 0) continue;

    const inner = result.slice(braceOpen + 1, braceClose);
    const innerLines = inner.split("\n");
    let li = innerLines.length - 1;
    while (li >= 0) {
      const t = innerLines[li]?.trim() ?? "";
      if (!t || t === "}" || t === "{") {
        li--;
        continue;
      }
      if (/^(function|async function)\b/.test(t)) break;
      if (t.startsWith("return ")) break;

      const indent = innerLines[li]?.match(/^\s*/)?.[0] ?? "";
      const expr = t.replace(/;\s*$/, "");
      innerLines[li] = `${indent}return ${expr};`;
      break;
    }

    const newInner = innerLines.join("\n");
    result = result.slice(0, braceOpen + 1) + newInner + result.slice(braceClose);
    withRe.lastIndex = braceOpen + 1 + newInner.length;
  }

  return result;
}

function legadoDeclAssignReturnName(line: string): string | null {
  const m = line.trim().match(/^(?:var|let|const)\s+([\w$]+)\s*=/);
  return m?.[1] ?? null;
}

/** 让 Node 与 Rhino eval 一样返回脚本最终结果 */
export function ensureLegadoScriptReturn(script: string): string {
  const trimmed = script.trim();
  if (!trimmed) return trimmed;

  if (!hasLegadoTopLevelStatements(trimmed)) {
    const expr = trimmed.replace(/;\s*$/, "");
    if (/^return\s+\([\s\S]*\)\s*;?\s*$/.test(trimmed)) return trimmed;
    return `return (${expr});`;
  }

  const lines = trimmed.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  if (i < 0) return trimmed;

  const last = lines[i].trim();
  // 仅看最后一行：函数体内的 return 不影响顶层表达式作返回值（Legado/Rhino 行为）
  if (!last || last.startsWith("return ")) return trimmed;
  const declNameFromLast = legadoDeclAssignReturnName(last);
  if (declNameFromLast) {
    const indent = lines[i].match(/^\s*/)?.[0] ?? "";
    return `${trimmed}\n${indent}return ${declNameFromLast};`;
  }
  // switch/if 等块末尾给 result 赋值：Rhino 从作用域读 result，Node 须补 return
  if (last.endsWith("}")) {
    if (/\bresult\s*=/.test(trimmed) && !/\breturn\s+result\b/.test(trimmed)) {
      return `${trimmed}\nreturn result;`;
    }
    return trimmed;
  }

  // 顶层 if/for 等语句后的单行返回值（如 loginCheckJs 末尾 result）勿回溯到 if 行
  const looksMultilineExpr =
    /[}\])]/.test(last) &&
    !/^(if|else|for|while|function|try|catch|class)\b/.test(last);
  const startLine = looksMultilineExpr
    ? findTrailingExpressionStartLine(lines, i)
    : i;
  const start = lines[startLine].trim();
  if (start.startsWith("return ")) return trimmed;

  const declNameFromStart = legadoDeclAssignReturnName(start);
  if (declNameFromStart) {
    const indent = lines[startLine].match(/^\s*/)?.[0] ?? "";
    return `${trimmed}\n${indent}return ${declNameFromStart};`;
  }

  const withoutSemi = start.replace(/;\s*$/, "");
  const indent = lines[startLine].match(/^\s*/)?.[0] ?? "";
  lines[startLine] = `${indent}return ${withoutSemi}`;
  if (startLine === i && !lines[i].trimEnd().endsWith(";")) {
    lines[i] = `${lines[i].trimEnd()};`;
  }
  return lines.join("\n");
}

/** `if (...) { foo() } else { bar() }` 分支内补 return（对齐 Legado/Rhino 返回值） */
export function ensureLegadoIfElseBranchReturn(script: string): string {
  if (/\breturn\s+[\w$]+\(\)/.test(script)) return script;
  return script.replace(
    /(\bif\s*\([\s\S]*?\)\s*\{\s*)([\w$]+\(\))(\s*\}\s*else\s*\{\s*)([\w$]+\(\))(\s*\})/g,
    "$1return $2$3return $4$5",
  );
}

/** `if(result){ eval(result) }` → 补 return eval(result)（Legado/Rhino 会返回 eval 结果） */
export function ensureLegadoIfEvalReturn(script: string): string {
  return script.replace(
    /(\bif\s*\(\s*result\s*\)\s*\{\s*)eval\s*\(\s*result\s*\)/g,
    "$1return eval(result)",
  );
}

/** 同步/异步 Legado JS 通用预处理 */
export function prepareLegadoJs(script: string): string {
  let s = script.trim().replace(/^@js:\s*/i, "");
  s = fixRhinoBareArrayArrowParams(s);
  s = ensureLegadoWithBlockReturn(s);
  s = ensureLegadoIfElseBranchReturn(s);
  s = ensureLegadoIfEvalReturn(s);
  s = ensureLegadoScriptReturn(s);
  return s;
}

/** 仅将函数体内含 await 的 function 提升为 async function（避免 urlEncode 等同步 helper 变 Promise） */
export function promoteFunctionsToAsyncForAwait(script: string): string {
  if (!/\bawait\b/.test(script)) return script;

  let out = "";
  let pos = 0;
  const headRe =
    /\b(?:(?:var|let|const)\s+\w+\s*=\s*)?(async\s+)?function(\s+[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*\{/g;

  let m: RegExpExecArray | null;
  while ((m = headRe.exec(script))) {
    out += script.slice(pos, m.index);
    if (m[1]) {
      out += m[0];
      pos = m.index + m[0].length;
      headRe.lastIndex = pos;
      continue;
    }
    const braceIdx = m.index + m[0].length - 1;
    const endBrace = findMatchingBrace(script, braceIdx);
    const fullFn = script.slice(m.index, endBrace + 1);
    if (/\bawait\b/.test(fullFn)) {
      out += fullFn.replace(
        /(\b(?:var|let|const)\s+\w+\s*=\s*)?function\b/,
        "$1async function",
      );
    } else {
      out += fullFn;
    }
    pos = endBrace + 1;
    headRe.lastIndex = pos;
  }
  out += script.slice(pos);
  return out;
}

/** 收集脚本中已声明的 async function 名 */
export function collectAsyncFunctionNames(script: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\basync\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s+function\b/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(script))) {
      if (m[1]) names.add(m[1]);
    }
  }
  return [...names];
}

/**
 * 对 async 函数的调用补 await。
 * Legado/Rhino 中嵌套函数调用是同步阻塞的；Node 中须逐层 await 才能等 toast 等副作用完成。
 */
export function awaitAsyncFunctionCalls(script: string): string {
  const names = collectAsyncFunctionNames(script);
  if (!names.length) return script;

  let s = script;
  for (const name of names) {
    const escaped = name.replace(/\$/g, "\\$");
    s = s.replace(
      new RegExp(`(?<![\\w.$])(?<!(?:await|function)\\s)${escaped}\\s*\\(`, "g"),
      `await ${name}(`,
    );
  }
  return s.replace(/\bawait\s+await\s+/g, "await ");
}

/** 交替提升 async 与补 await，直到嵌套调用链稳定 */
export function promoteLegadoAsyncCallChain(script: string): string {
  let s = script;
  for (let i = 0; i < 4; i++) {
    const next = awaitAsyncFunctionCalls(promoteFunctionsToAsyncForAwait(s));
    if (next === s) break;
    s = next;
  }
  return s;
}

const JAVA_HTTP_CHAIN_MEMBER =
  /^(matchAll|match|trim|replace|split|slice|substring|indexOf|includes|startsWith|body|header|headers|code|url|raw)\s*\(/;

function wrapAwaitJavaHttpMemberAccess(script: string): string {
  const methods = ["ajax", "connect", "get", "post"] as const;
  let s = script;

  for (const method of methods) {
    const prefix = `await java.${method}(`;
    while (true) {
      let wrapAt = -1;
      let wrapClose = -1;

      for (let pos = 0; pos < s.length; ) {
        const start = s.indexOf(prefix, pos);
        if (start < 0) break;
        pos = start + 1;

        const openParen = start + prefix.length - 1;
        const closeParen = findMatchingParen(s, openParen);
        if (closeParen < 0) continue;

        const after = s.slice(closeParen + 1);
        if (!after.startsWith(".") || !JAVA_HTTP_CHAIN_MEMBER.test(after.slice(1))) {
          continue;
        }

        const alreadyWrapped =
          start > 0 && s[start - 1] === "(" && s[closeParen + 1] === ")";
        if (alreadyWrapped) continue;

        wrapAt = start;
        wrapClose = closeParen;
      }

      if (wrapAt < 0) break;
      s = `${s.slice(0, wrapAt)}(${s.slice(wrapAt, wrapClose + 1)})${s.slice(wrapClose + 1)}`;
    }
  }

  return s;
}

export function prepareLegadoAsyncJs(script: string): string {
  let s = prepareLegadoJs(script);

  // startBrowserAwait(...).body() / .code() / .url()
  s = s.replace(
    /java\.startBrowserAwait\(((?:[^()]|\([^()]*\))*)\)\.(body|code|url)\(\)/g,
    "(await java.startBrowserAwait($1)).$2()",
  );

  const asyncJavaCalls = [
    "startBrowserAwait",
    "ajax",
    "connect",
    "get",
    "post",
    "getVerificationCode",
  ] as const;
  for (const name of asyncJavaCalls) {
    if (!new RegExp(`\\bawait\\s+java\\.${name}\\s*\\(`).test(s)) {
      s = s.replace(
        new RegExp(`\\bjava\\.${name}\\s*\\(`, "g"),
        `await java.${name}(`,
      );
    }
  }

  s = wrapAwaitJavaHttpMemberAccess(s);

  s = s.replace(/\bawait\s+await\s+/g, "await ");
  s = promoteLegadoAsyncCallChain(s);

  return `(async () => { ${s} })()`;
}
