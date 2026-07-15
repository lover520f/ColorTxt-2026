import { formatLegadoBookAuthor } from "@shared/bookSource/formatBookAuthor";

/** 从 kind 标签中提取日期作为更新时间兜底 */
export function extractUpdateTimeFromKind(kind?: string): string {
  const raw = kind?.trim();
  if (!raw) return "";
  const m = raw.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/);
  return m ? m[0].replace(/-/g, "/") : "";
}

type BookshelfDisplayFields = {
  updateTime?: string;
  kind?: string;
  lastChapter?: string;
  lastReadChapterTitle?: string;
  lastReadChapterIndex?: number;
  author?: string;
};

export function resolveBookshelfUpdateTime(book: BookshelfDisplayFields): string {
  return book.updateTime?.trim() || extractUpdateTimeFromKind(book.kind);
}

/** 「最新章节：xxx（更新时间：xxx）」中的章节段 */
export function formatBookshelfLatestChapter(book: BookshelfDisplayFields): string {
  const chapter = book.lastChapter?.trim();
  if (!chapter) return "暂无";
  const updateTime = resolveBookshelfUpdateTime(book);
  return updateTime ? `${chapter}（更新时间：${updateTime}）` : chapter;
}

export function formatBookshelfLastRead(book: BookshelfDisplayFields): string {
  const title = book.lastReadChapterTitle?.trim();
  if (title) return title;
  if (
    typeof book.lastReadChapterIndex === "number" &&
    Number.isFinite(book.lastReadChapterIndex) &&
    book.lastReadChapterIndex >= 0
  ) {
    return `第 ${book.lastReadChapterIndex + 1} 章`;
  }
  return "暂无";
}

/**
 * 最后阅读章节是否已是最新章节（标题比对；不含「更新时间」后缀）。
 * `lastReadDisplay` 优先（可为异步解析的章节名）。
 */
export function isBookshelfCaughtUpToLatest(
  book: Pick<BookshelfDisplayFields, "lastChapter" | "lastReadChapterTitle">,
  lastReadDisplay?: string,
): boolean {
  const latest = book.lastChapter?.trim();
  if (!latest) return false;
  const read = (lastReadDisplay?.trim() || book.lastReadChapterTitle?.trim() || "");
  if (!read || read === "暂无") return false;
  return read === latest;
}

/** 作者行：对齐 Legado 作者净化 */
export function formatBookshelfAuthor(author: string | undefined): string {
  return formatLegadoBookAuthor(author) || "未知";
}

/** 书架继续阅读：有进度用保存的下标，否则从目录数组末尾（第一章） */
export function resolveBookshelfReadChapterIndex(
  book: { lastReadChapterIndex?: number },
  contentChapterCount: number,
): number {
  if (contentChapterCount <= 0) return 0;
  const idx = book.lastReadChapterIndex;
  if (
    typeof idx === "number" &&
    Number.isFinite(idx) &&
    idx >= 0 &&
    idx < contentChapterCount
  ) {
    return idx;
  }
  return contentChapterCount - 1;
}
