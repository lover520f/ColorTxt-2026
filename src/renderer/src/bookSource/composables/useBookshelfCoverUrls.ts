import { ref, watch, type Ref } from "vue";
import type { SearchBookItem } from "@shared/bookSource/types";
import { updateFindBookBookshelfCover } from "../findBookBookshelf";

function shouldResolveCover(item: SearchBookItem): boolean {
  const url = item.coverUrl?.trim();
  if (!url) return true;
  return url.startsWith("colortxt-local:");
}

function inferCoverSourceUrl(item: SearchBookItem): string | undefined {
  const source = item.coverSourceUrl?.trim();
  if (source) return source;
  const url = item.coverUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  return undefined;
}

/** 书架封面：colortxt-local 代理 URL 仅在内存中，需用 coverSourceUrl 重新解析 */
export function useBookshelfCoverUrls(books: Ref<readonly SearchBookItem[]>) {
  const coverUrls = ref<Record<string, string>>({});
  const resolvingIds = new Set<string>();

  async function resolveCover(item: SearchBookItem): Promise<void> {
    if (resolvingIds.has(item.id)) return;
    if (!shouldResolveCover(item) && item.coverUrl) {
      coverUrls.value = { ...coverUrls.value, [item.id]: item.coverUrl };
      return;
    }

    resolvingIds.add(item.id);
    try {
      const res = await window.colorTxt.bookSourceResolveCoverDisplay({
        bookSourceUrl: item.origin,
        coverSourceUrl: inferCoverSourceUrl(item),
        coverUrl: item.coverUrl,
        bookUrl: item.bookUrl,
        name: item.name,
        author: item.author,
        kind: item.kind,
        wordCount: item.wordCount,
        intro: item.intro,
        lastChapter: item.lastChapter,
      });
      if (!res.coverUrl) return;
      coverUrls.value = { ...coverUrls.value, [item.id]: res.coverUrl };
      updateFindBookBookshelfCover(item.bookUrl, item.origin, {
        coverUrl: res.coverUrl,
        coverSourceUrl: res.coverSourceUrl ?? inferCoverSourceUrl(item),
      });
    } finally {
      resolvingIds.delete(item.id);
    }
  }

  watch(
    books,
    (list) => {
      for (const item of list) {
        void resolveCover(item);
      }
    },
    { immediate: true },
  );

  function getCoverUrl(item: SearchBookItem): string | undefined {
    const resolved = coverUrls.value[item.id];
    if (resolved) return resolved;
    if (shouldResolveCover(item)) return undefined;
    return item.coverUrl;
  }

  async function retryCover(item: SearchBookItem): Promise<boolean> {
    const prev = getCoverUrl(item);
    await resolveCover(item);
    const next = getCoverUrl(item);
    return Boolean(next && next !== prev);
  }

  return { getCoverUrl, retryCover };
}
