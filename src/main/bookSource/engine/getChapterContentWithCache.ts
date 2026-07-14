/**
 * 带离线缓存的章节正文：先读本地，miss 再联网，成功后写入缓存。
 * 阅读与整书下载共用。
 */
import type { BookSourceRecord } from "@shared/bookSource/types";
import { getChapterContent } from "./webBook";
import { readChapterCache, saveChapterCache } from "./chapterCache";

export type ChapterContentBook = {
  name: string;
  author?: string;
  bookUrl: string;
  tocUrl: string;
};

export type ChapterContentChapter = {
  title: string;
  url: string;
  index: number;
};

export async function getChapterContentWithCache(
  source: BookSourceRecord,
  chapterUrl: string,
  book: ChapterContentBook,
  chapter: ChapterContentChapter,
  logs: string[] = [],
  nextChapterUrl?: string,
  options?: { preferCache?: boolean; cacheDir?: string },
): Promise<{ content: string; fromCache: boolean }> {
  const preferCache = options?.preferCache !== false;
  const cacheDir = options?.cacheDir;
  const bookName = book.name || "";
  const bookUrl = book.bookUrl || "";

  if (preferCache && bookUrl && chapterUrl) {
    const cached = await readChapterCache(
      bookName,
      bookUrl,
      chapterUrl,
      cacheDir,
    );
    if (cached != null) {
      return { content: cached, fromCache: true };
    }
  }

  const content = await getChapterContent(
    source,
    chapterUrl,
    book,
    chapter,
    logs,
    nextChapterUrl,
  );

  if (bookUrl && chapterUrl && typeof content === "string" && content.length) {
    try {
      await saveChapterCache(
        bookName,
        bookUrl,
        chapterUrl,
        content,
        cacheDir,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logs.push(`写入章节缓存失败: ${msg}`);
    }
  }

  return { content, fromCache: false };
}
