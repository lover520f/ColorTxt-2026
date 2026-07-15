import { formatLegadoBookAuthor } from "@shared/bookSource/formatBookAuthor";

/** 书籍列表作者行：净化后补「作者：」前缀（对齐 Legado 展示） */
export function formatBookAuthor(author: string | undefined): string {
  const a = formatLegadoBookAuthor(author) || "未知";
  return `作者：${a}`;
}

/** 默认封面作者标签 */
export function formatCoverAuthor(author: string | undefined): string {
  return formatLegadoBookAuthor(author) || "未知";
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
