/** Legado AppPattern.authorRegex + BookHelp.formatBookAuthor */
const LEGADO_AUTHOR_REGEX = /^\s*作\s*者[:：\s]+|\s+著/g;

/**
 * 净化作者名：去掉「作　者：」「作者：」等标签及尾部「 著」。
 * 对齐 Legado `BookHelp.formatBookAuthor` / `AppPattern.authorRegex`。
 */
export function formatLegadoBookAuthor(author: string | undefined | null): string {
  const raw = author?.trim() ?? "";
  if (!raw) return "";
  return raw.replace(LEGADO_AUTHOR_REGEX, "").trim();
}
