import { DOMParser, type Document } from "@xmldom/xmldom";
import * as cheerio from "cheerio";
import xpath from "xpath";

/** 忽略 xmldom 解析告警，避免控制台刷屏 */
const silentOnError = (
  _level: "warning" | "error" | "fatalError",
  _msg: string,
  _context: unknown,
): void => {};

/** HTML 中裸 &（非合法实体）转义，避免 xmldom 刷屏 entity not found */
export function escapeBareAmpersands(html: string): string {
  return html.replace(/&(?!([a-zA-Z][a-zA-Z0-9]*|#\d+|#x[\da-fA-F]+);)/g, "&amp;");
}

export function parseHtmlDocument(html: string): Document {
  const safe = escapeBareAmpersands(html);
  return new DOMParser({ onError: silentOnError }).parseFromString(
    safe,
    "text/html",
  );
}

/**
 * 部分书源常用的 og:meta XPath，用 cheerio 解析（对齐 Legado + Jsoup 的容错）。
 */
export function xpathViaCheerio(
  rule: string,
  html: string,
  list: boolean,
): unknown | undefined {
  const trimmed = rule.trim();
  const metaAttr = trimmed.match(
    /^\/\/meta\[(@property|@name)=['"]([^'"]+)['"]\]\/@(\w+)$/,
  );
  if (metaAttr) {
    const attrName = metaAttr[1].slice(1);
    const attrVal = metaAttr[2];
    const pick = metaAttr[3];
    const $ = cheerio.load(html);
    const val =
      $(`meta[${attrName}="${attrVal}"]`).attr(pick) ??
      $(`meta[${attrName}='${attrVal}']`).attr(pick) ??
      "";
    return list ? (val ? [val] : []) : val;
  }

  const metaText = trimmed.match(
    /^\/\/meta\[(@property|@name)=['"]([^'"]+)['"]\]\/(?:text\(\)|@content)$/,
  );
  if (metaText) {
    const attrName = metaText[1].slice(1);
    const attrVal = metaText[2];
    const $ = cheerio.load(html);
    const val =
      $(`meta[${attrName}="${attrVal}"]`).attr("content")?.trim() ?? "";
    return list ? (val ? [val] : []) : val;
  }

  // xmldom 解析 HTML 时会丢弃 <script>，Legado/Jsoup 仍可读取 script 文本
  if (/^\/\/script\/text\(\)$/.test(trimmed)) {
    const $ = cheerio.load(html);
    const texts: string[] = [];
    $("script").each((_, el) => {
      const t = $(el).text().trim();
      if (t) texts.push(t);
    });
    return list ? texts : (texts[0] ?? "");
  }

  return undefined;
}

export function selectXPath(
  rule: string,
  html: string,
  list: boolean,
): unknown {
  const viaCheerio = xpathViaCheerio(rule, html, list);
  if (viaCheerio !== undefined) return viaCheerio;

  const doc = parseHtmlDocument(html);
  const nodes = xpath.select(rule, doc as unknown as Node) as Node[];
  if (!nodes?.length) return list ? [] : "";
  const texts = nodes.map(textOfXPathNode);
  return list ? texts : (texts[0] ?? "");
}

function textOfXPathNode(node: Node): string {
  if ("textContent" in node) {
    return (node as { textContent?: string }).textContent ?? "";
  }
  return "";
}
