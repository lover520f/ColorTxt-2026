/** 书籍列表作者行：无「作者：」前缀时补上 */
export function formatBookAuthor(author: string | undefined): string {
  const a = author?.trim() || "未知";
  if (/^作者[：:]/.test(a)) return a;
  return `作者：${a}`;
}

/** 默认封面作者标签：「xx　著」 */
export function formatCoverAuthor(author: string | undefined): string {
  const a = author?.trim().replace(/^作者[：:]\s*/, "") || "未知";
  // return `${a} 著`;
  return a;
}

export {
  getBookKindList,
  splitBookMetaTags,
} from "@shared/bookSource/bookMetaTags";

/** 简介展示：保留 Legado 段首全角缩进，仅去掉末尾空白 */
export function formatBookIntroForDisplay(intro: string | undefined | null): string {
  const raw = intro ?? "";
  if (!raw.trim()) return "";
  return raw.trimEnd();
}
