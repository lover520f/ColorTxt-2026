import { ref, watch, type Ref } from "vue";
import type { SearchBookItem } from "@shared/bookSource/types";
import { updateFindBookBookshelfCover } from "../findBookBookshelf";

/** 需走主进程代理解析的封面（直链常被防盗链，应用内须带书源 headers） */
function shouldResolveCover(item: SearchBookItem): boolean {
  const url = item.coverUrl?.trim();
  if (!url) return true;
  if (url.startsWith("data:")) return false;
  if (url.startsWith("colortxt-local:")) return true;
  return /^https?:\/\//i.test(url);
}

function inferCoverSourceUrl(item: SearchBookItem): string | undefined {
  const source = item.coverSourceUrl?.trim();
  if (source) return source;
  const url = item.coverUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  return undefined;
}

/**
 * 书架 / 搜索 / 发现：异步解析可展示封面。
 * - 解析中：无 URL、pending=true → 列表显示占位，不用默认封面
 * - 成功：返回代理 URL
 * - 最终失败：failed → 列表再用默认封面兜底
 */
export function useBookshelfCoverUrls(books: Ref<readonly SearchBookItem[]>) {
  const coverUrls = ref<Record<string, string>>({});
  const failedIds = ref<Record<string, true>>({});
  const pendingIds = ref<Record<string, true>>({});
  const resolvingIds = new Set<string>();

  function setPending(id: string, on: boolean) {
    if (on) {
      if (pendingIds.value[id]) return;
      pendingIds.value = { ...pendingIds.value, [id]: true };
      return;
    }
    if (!pendingIds.value[id]) return;
    const next = { ...pendingIds.value };
    delete next[id];
    pendingIds.value = next;
  }

  async function resolveCover(item: SearchBookItem): Promise<void> {
    if (resolvingIds.has(item.id)) return;
    if (coverUrls.value[item.id] || failedIds.value[item.id]) return;

    if (!shouldResolveCover(item)) {
      const raw = item.coverUrl?.trim();
      if (raw) coverUrls.value = { ...coverUrls.value, [item.id]: raw };
      else failedIds.value = { ...failedIds.value, [item.id]: true };
      return;
    }

    resolvingIds.add(item.id);
    setPending(item.id, true);
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
      if (!res.coverUrl) {
        failedIds.value = { ...failedIds.value, [item.id]: true };
        return;
      }
      coverUrls.value = { ...coverUrls.value, [item.id]: res.coverUrl };
      updateFindBookBookshelfCover(item.bookUrl, item.origin, {
        coverUrl: res.coverUrl,
        coverSourceUrl: res.coverSourceUrl ?? inferCoverSourceUrl(item),
      });
    } catch {
      failedIds.value = { ...failedIds.value, [item.id]: true };
    } finally {
      resolvingIds.delete(item.id);
      setPending(item.id, false);
    }
  }

  watch(
    () => books.value.map((b) => b.id),
    () => {
      for (const item of books.value) {
        void resolveCover(item);
      }
    },
    { immediate: true },
  );

  function getCoverUrl(item: SearchBookItem): string | undefined {
    if (failedIds.value[item.id]) return undefined;
    return coverUrls.value[item.id];
  }

  function isCoverPending(item: SearchBookItem): boolean {
    if (coverUrls.value[item.id] || failedIds.value[item.id]) return false;
    if (pendingIds.value[item.id]) return true;
    // 已进入列表、尚未 kick resolve 的瞬时态也视为 pending（避免闪默认封面）
    return shouldResolveCover(item);
  }

  async function retryCover(item: SearchBookItem): Promise<boolean> {
    const prev = getCoverUrl(item);
    const nextFailed = { ...failedIds.value };
    delete nextFailed[item.id];
    failedIds.value = nextFailed;
    const nextUrls = { ...coverUrls.value };
    delete nextUrls[item.id];
    coverUrls.value = nextUrls;
    await resolveCover(item);
    const next = getCoverUrl(item);
    return Boolean(next && next !== prev);
  }

  return { getCoverUrl, isCoverPending, retryCover };
}
