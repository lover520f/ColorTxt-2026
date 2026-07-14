import type { BookChapter, BookDetail } from "@shared/bookSource/types";
import {
  updateFindBookBookshelfBookInfo,
  type BookshelfBook,
} from "./findBookBookshelf";
import { resolveBookshelfReadChapterIndex } from "./findBookshelfDisplay";

export function buildBookDetailFromShelf(book: BookshelfBook): BookDetail {
  return {
    name: book.name,
    author: book.author,
    intro: book.intro ?? "",
    coverUrl: book.coverUrl ?? "",
    coverSourceUrl: book.coverSourceUrl,
    kind: book.kind ?? "",
    wordCount: book.wordCount,
    lastChapter: book.lastChapter,
    updateTime: book.updateTime,
    tocUrl: book.tocUrl ?? "",
    bookUrl: book.bookUrl,
  };
}

export function hasCachedBookshelfToc(book: BookshelfBook): boolean {
  return Boolean(book.tocUrl?.trim() && book.chapters?.length);
}

export type BookshelfReaderPayload = {
  detail: BookDetail;
  chapters: BookChapter[];
  chapterIndex: number;
};

export async function loadBookshelfReaderPayload(
  book: BookshelfBook,
): Promise<{ payload: BookshelfReaderPayload | null; books?: BookshelfBook[]; message?: string }> {
  if (hasCachedBookshelfToc(book)) {
    const detail = buildBookDetailFromShelf(book);
    const chapters = book.chapters!;
    const contentCount = chapters.filter((ch) => !ch.isVolume).length;
    return {
      payload: {
        detail,
        chapters,
        chapterIndex: resolveBookshelfReadChapterIndex(book, contentCount),
      },
    };
  }

  let detail: BookDetail;
  if (book.tocUrl?.trim()) {
    detail = buildBookDetailFromShelf(book);
  } else {
    const infoRes = await window.colorTxt.bookSourceGetBookInfo({
      bookSourceUrl: book.origin,
      bookUrl: book.bookUrl,
      name: book.name,
      author: book.author,
      kind: book.kind,
      wordCount: book.wordCount,
      intro: book.intro,
      lastChapter: book.lastChapter,
      coverUrl: book.coverUrl,
    });
    if (!infoRes.detail) {
      return { payload: null, message: infoRes.message ?? "加载书籍失败" };
    }
    detail = infoRes.detail;
  }

  const tocRes = await window.colorTxt.bookSourceGetChapterList({
    bookSourceUrl: book.origin,
    bookUrl: detail.bookUrl,
    tocUrl: detail.tocUrl,
  });
  const chapters = tocRes.chapters ?? [];
  const contentChapters = chapters.filter((ch) => !ch.isVolume);
  if (!contentChapters.length) {
    return {
      payload: null,
      message: tocRes.message || "暂无章节",
    };
  }

  const next = updateFindBookBookshelfBookInfo(book.bookUrl, book.origin, {
    tocUrl: detail.tocUrl,
    chapters,
    bookUrl: detail.bookUrl?.trim() || book.bookUrl,
  });

  return {
    payload: {
      detail,
      chapters,
      chapterIndex: resolveBookshelfReadChapterIndex(book, contentChapters.length),
    },
    books: next ?? undefined,
  };
}
