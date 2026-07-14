/** 对齐 Legado AnalyzeByRegex：用正则捕获组提取列表/单项 */

export function regexGetElement(
  text: string,
  regs: string[],
  index = 0,
): string[] | null {
  if (index >= regs.length) return null;
  let re: RegExp;
  try {
    re = new RegExp(regs[index], "g");
  } catch {
    return null;
  }
  const m = re.exec(text);
  if (!m) return null;

  if (index + 1 === regs.length) {
    const info: string[] = [];
    for (let g = 0; g <= m.length - 1; g++) {
      info.push(m[g] ?? "");
    }
    return info;
  }

  let joined = "";
  re.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text))) {
    joined += mm[0];
  }
  return regexGetElement(joined, regs, index + 1);
}

export function regexGetElements(
  text: string,
  regs: string[],
  index = 0,
): string[][] {
  if (index >= regs.length) return [];
  let re: RegExp;
  try {
    re = new RegExp(regs[index], "g");
  } catch {
    return [];
  }
  const first = re.exec(text);
  if (!first) return [];

  if (index + 1 === regs.length) {
    const books: string[][] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const info: string[] = [];
      for (let g = 0; g <= m.length - 1; g++) {
        info.push(m[g] ?? "");
      }
      books.push(info);
    }
    return books;
  }

  let joined = "";
  re.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text))) {
    joined += mm[0];
  }
  return regexGetElements(joined, regs, index + 1);
}

export function parseRegexRuleList(rule: string): string[] {
  let r = rule.trim();
  if (r.startsWith(":")) r = r.slice(1);
  return r
    .split("&&")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function looksLikeLegadoRegexRule(rule: string): boolean {
  const t = rule.trim();
  if (!t) return false;
  if (t.startsWith(":")) return true;
  if (/^\$\d{1,2}(?:@|##|$)/.test(t)) return false;
  if (t.startsWith("$.") || t.startsWith("$[")) return false;
  if (/\\(\?:|\.|\d|\+|\*|\?|\[)/.test(t) && !/^(class|tag|id)\./.test(t)) {
    return true;
  }
  return false;
}
