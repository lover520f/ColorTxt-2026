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

/** 作者行：去掉重复「作者：」前缀 */
export function formatBookshelfAuthor(author: string | undefined): string {
  return author?.trim().replace(/^作者[：:]\s*/, "") || "未知";
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
