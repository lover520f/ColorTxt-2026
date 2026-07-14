import type { BookChapter, SearchBookItem } from "@shared/bookSource/types";
import { extractUpdateTimeFromKind } from "./findBookshelfDisplay";

const STORAGE_KEY = "colortxt:findBookBookshelf";

export type BookshelfBook = SearchBookItem & {
  savedAt: number;
  /** 内容章节下标（与 getChapterContent 的 chapterIndex 一致，0 为目录数组中的最新章） */
  lastReadChapterIndex?: number;
  /** 最后阅读章节标题 */
  lastReadChapterTitle?: string;
  /** 书籍更新时间（详情页或 kind 日期） */
  updateTime?: string;
  /** 最后阅读时间戳（对齐 Legado durChapterTime） */
  lastReadAt?: number;
  /** 是否允许书架更新；缺省或为 true 表示允许 */
  canUpdate?: boolean;
  /** 目录 URL（缓存后可跳过 getBookInfo） */
  tocUrl?: string;
  /** 章节目录缓存（打开阅读器时复用） */
  chapters?: BookChapter[];
};

export type BookshelfBookInfoPatch = {
  name?: string;
  author?: string;
  intro?: string;
  coverUrl?: string;
  coverSourceUrl?: string;
  lastChapter?: string;
  kind?: string;
  wordCount?: string;
  updateTime?: string;
  bookUrl?: string;
  tocUrl?: string;
  chapters?: BookChapter[];
};

export type BookshelfAddOptions = {
  updateTime?: string;
};

export function bookshelfBookKey(bookUrl: string, origin: string): string {
  return `${origin.trim()}\0${bookUrl.trim()}`;
}

function isSearchBookItem(v: unknown): v is SearchBookItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.author === "string" &&
    typeof o.bookUrl === "string" &&
    typeof o.origin === "string" &&
    typeof o.originName === "string"
  );
}

function isBookChapter(v: unknown): v is BookChapter {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.url === "string" &&
    typeof o.isVolume === "boolean" &&
    typeof o.isVip === "boolean"
  );
}

function normalizeBookChapters(raw: unknown): BookChapter[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: BookChapter[] = [];
  for (const item of raw) {
    if (!isBookChapter(item)) continue;
    out.push({
      title: item.title,
      url: item.url,
      isVolume: item.isVolume,
      isVip: item.isVip,
      ...(typeof item.isPay === "boolean" ? { isPay: item.isPay } : {}),
    });
  }
  return out.length ? out : undefined;
}

function normalizeBookshelf(raw: unknown): BookshelfBook[] {
  if (!Array.isArray(raw)) return [];
  const out: BookshelfBook[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isSearchBookItem(item)) continue;
    const key = bookshelfBookKey(item.bookUrl, item.origin);
    if (seen.has(key)) continue;
    seen.add(key);
    const savedAt =
      typeof (item as BookshelfBook).savedAt === "number"
        ? (item as BookshelfBook).savedAt
        : Date.now();
    const lastReadChapterIndex =
      typeof (item as BookshelfBook).lastReadChapterIndex === "number" &&
      Number.isFinite((item as BookshelfBook).lastReadChapterIndex) &&
      (item as BookshelfBook).lastReadChapterIndex! >= 0
        ? Math.floor((item as BookshelfBook).lastReadChapterIndex!)
        : undefined;
    const lastReadChapterTitle =
      typeof (item as BookshelfBook).lastReadChapterTitle === "string" &&
      (item as BookshelfBook).lastReadChapterTitle!.trim()
        ? (item as BookshelfBook).lastReadChapterTitle!.trim()
        : undefined;
    const updateTime =
      typeof (item as BookshelfBook).updateTime === "string" &&
      (item as BookshelfBook).updateTime!.trim()
        ? (item as BookshelfBook).updateTime!.trim()
        : undefined;
    const lastReadAt =
      typeof (item as BookshelfBook).lastReadAt === "number" &&
      Number.isFinite((item as BookshelfBook).lastReadAt)
        ? (item as BookshelfBook).lastReadAt!
        : undefined;
    const canUpdate =
      (item as BookshelfBook).canUpdate === false ? false : undefined;
    const tocUrl =
      typeof (item as BookshelfBook).tocUrl === "string" &&
      (item as BookshelfBook).tocUrl!.trim()
        ? (item as BookshelfBook).tocUrl!.trim()
        : undefined;
    const chapters = normalizeBookChapters((item as BookshelfBook).chapters);
    out.push({
      ...item,
      savedAt,
      ...(lastReadChapterIndex !== undefined ? { lastReadChapterIndex } : {}),
      ...(lastReadChapterTitle ? { lastReadChapterTitle } : {}),
      ...(updateTime ? { updateTime } : {}),
      ...(lastReadAt !== undefined ? { lastReadAt } : {}),
      ...(canUpdate === false ? { canUpdate: false } : {}),
      ...(tocUrl ? { tocUrl } : {}),
      ...(chapters ? { chapters } : {}),
    });
  }
  return out;
}

export function loadFindBookBookshelf(): BookshelfBook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeBookshelf(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveFindBookBookshelf(items: BookshelfBook[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

export function isInFindBookBookshelf(bookUrl: string, origin: string): boolean {
  const key = bookshelfBookKey(bookUrl, origin);
  return loadFindBookBookshelf().some(
    (b) => bookshelfBookKey(b.bookUrl, b.origin) === key,
  );
}

export function addToFindBookBookshelf(
  item: SearchBookItem,
  options?: BookshelfAddOptions,
): BookshelfBook[] {
  const key = bookshelfBookKey(item.bookUrl, item.origin);
  const prev = loadFindBookBookshelf().filter(
    (b) => bookshelfBookKey(b.bookUrl, b.origin) !== key,
  );
  const updateTime =
    options?.updateTime?.trim() || extractUpdateTimeFromKind(item.kind) || undefined;
  const next: BookshelfBook[] = [
    {
      id: item.id,
      name: item.name,
      author: item.author,
      intro: item.intro,
      kind: item.kind,
      wordCount: item.wordCount,
      lastChapter: item.lastChapter,
      coverUrl: item.coverUrl,
      coverSourceUrl: item.coverSourceUrl,
      bookUrl: item.bookUrl,
      origin: item.origin,
      originName: item.originName,
      savedAt: Date.now(),
      ...(updateTime ? { updateTime } : {}),
    },
    ...prev,
  ];
  saveFindBookBookshelf(next);
  return next;
}

/** 解析封面成功后回写书架（更新代理 URL 与原始 URL） */
export function updateFindBookBookshelfCover(
  bookUrl: string,
  origin: string,
  cover: { coverUrl?: string; coverSourceUrl?: string },
): BookshelfBook[] | null {
  const key = bookshelfBookKey(bookUrl, origin);
  let changed = false;
  const next = loadFindBookBookshelf().map((b) => {
    if (bookshelfBookKey(b.bookUrl, b.origin) !== key) return b;
    changed = true;
    return {
      ...b,
      ...(cover.coverUrl ? { coverUrl: cover.coverUrl } : {}),
      ...(cover.coverSourceUrl ? { coverSourceUrl: cover.coverSourceUrl } : {}),
    };
  });
  if (!changed) return null;
  saveFindBookBookshelf(next);
  return next;
}

/** 更新书架书籍信息（保留阅读进度与排序相关字段） */
export function updateFindBookBookshelfBookInfo(
  bookUrl: string,
  origin: string,
  patch: BookshelfBookInfoPatch,
): BookshelfBook[] | null {
  const key = bookshelfBookKey(bookUrl, origin);
  let changed = false;
  const next = loadFindBookBookshelf().map((b) => {
    if (bookshelfBookKey(b.bookUrl, b.origin) !== key) return b;
    changed = true;
    const merged: BookshelfBook = { ...b };
    if (patch.name?.trim()) merged.name = patch.name.trim();
    if (patch.author?.trim()) merged.author = patch.author.trim();
    if (patch.intro !== undefined) merged.intro = patch.intro;
    if (patch.coverUrl?.trim()) merged.coverUrl = patch.coverUrl.trim();
    if (patch.coverSourceUrl?.trim()) {
      merged.coverSourceUrl = patch.coverSourceUrl.trim();
    }
    if (patch.lastChapter?.trim()) merged.lastChapter = patch.lastChapter.trim();
    if (patch.kind !== undefined) merged.kind = patch.kind;
    if (patch.wordCount !== undefined) merged.wordCount = patch.wordCount;
    if (patch.updateTime?.trim()) merged.updateTime = patch.updateTime.trim();
    if (patch.bookUrl?.trim() && patch.bookUrl.trim() !== b.bookUrl) {
      merged.bookUrl = patch.bookUrl.trim();
    }
    if (patch.tocUrl?.trim()) merged.tocUrl = patch.tocUrl.trim();
    if (patch.chapters?.length) merged.chapters = patch.chapters;
    return merged;
  });
  if (!changed) return null;
  saveFindBookBookshelf(next);
  return next;
}

/** 设置书架书籍是否允许更新 */
export function setFindBookBookshelfCanUpdate(
  bookUrl: string,
  origin: string,
  canUpdate: boolean,
): BookshelfBook[] | null {
  const key = bookshelfBookKey(bookUrl, origin);
  let changed = false;
  const next = loadFindBookBookshelf().map((b) => {
    if (bookshelfBookKey(b.bookUrl, b.origin) !== key) return b;
    const prev = b.canUpdate !== false;
    if (prev === canUpdate) return b;
    changed = true;
    if (canUpdate) {
      const { canUpdate: _, ...rest } = b;
      return rest as BookshelfBook;
    }
    return { ...b, canUpdate: false };
  });
  if (!changed) return null;
  saveFindBookBookshelf(next);
  return next;
}

export function removeFromFindBookBookshelf(
  bookUrl: string,
  origin: string,
): BookshelfBook[] {
  const key = bookshelfBookKey(bookUrl, origin);
  const next = loadFindBookBookshelf().filter(
    (b) => bookshelfBookKey(b.bookUrl, b.origin) !== key,
  );
  saveFindBookBookshelf(next);
  return next;
}

/** 更新书架书籍的最后阅读章节（仅当已在书架中时生效） */
export function updateFindBookBookshelfReadProgress(
  bookUrl: string,
  origin: string,
  chapterIndex: number,
  chapterTitle?: string,
): BookshelfBook[] | null {
  if (!Number.isFinite(chapterIndex) || chapterIndex < 0) return null;
  const key = bookshelfBookKey(bookUrl, origin);
  const idx = Math.floor(chapterIndex);
  const title = chapterTitle?.trim();
  let changed = false;
  const next = loadFindBookBookshelf().map((b) => {
    if (bookshelfBookKey(b.bookUrl, b.origin) !== key) return b;
    changed = true;
    return {
      ...b,
      lastReadChapterIndex: idx,
      lastReadAt: Date.now(),
      ...(title ? { lastReadChapterTitle: title } : {}),
    };
  });
  if (!changed) return null;
  saveFindBookBookshelf(next);
  return next;
}
