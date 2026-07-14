import type { Cheerio, CheerioAPI } from "cheerio";

export type LegadoAttrSelector = {
  attr: string;
  op: "=" | "$=" | "^=" | "*=" | "~=";
  values: string[];
};

/** Legado/书源常用 meta 属性选择器：[name$=author]、[name~=a|b|c] */
export function parseLegadoAttrSelector(segment: string): LegadoAttrSelector | null {
  const seg = segment.trim();
  const m = seg.match(/^\[([\w-]+)(=|\$=|\^=|\*=|~=)([^\]]+)\]$/);
  if (!m) return null;
  const values = m[3]
    .split("|")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  if (!values.length) return null;
  return {
    attr: m[1],
    op: m[2] as LegadoAttrSelector["op"],
    values,
  };
}

export function isLegadoAttrSelectorSegment(segment: string): boolean {
  return parseLegadoAttrSelector(segment) != null;
}

export function matchLegadoAttrValue(
  attrValue: string | undefined,
  sel: LegadoAttrSelector,
): boolean {
  if (attrValue == null) return false;
  const v = attrValue;
  switch (sel.op) {
    case "=":
      return sel.values.some((x) => v === x);
    case "$=":
      return sel.values.some((x) => v.endsWith(x));
    case "^=":
      return sel.values.some((x) => v.startsWith(x));
    case "*=":
    case "~=":
      return sel.values.some((x) => v.includes(x));
    default:
      return false;
  }
}

export function queryLegadoAttrSelector(
  $: CheerioAPI,
  segment: string,
): Cheerio<any> {
  const parsed = parseLegadoAttrSelector(segment);
  if (!parsed) {
    try {
      return $(segment);
    } catch {
      return $("");
    }
  }
  // Legado AnalyzeByJSoup：带引号的 [name="og:image"] 等走 CSS 选择器
  if (parsed.op === "=" && parsed.values.length === 1) {
    try {
      const viaCss = $(`[${parsed.attr}="${parsed.values[0]}"]`);
      if (viaCss.length) return viaCss;
    } catch {
      /* fallback to meta scan */
    }
  }
  const matched: any[] = [];
  $("meta, link, [name], [property], [content]").each((_, el) => {
    const val = $(el).attr(parsed.attr);
    if (matchLegadoAttrValue(val, parsed)) matched.push(el);
  });
  return $(matched);
}
