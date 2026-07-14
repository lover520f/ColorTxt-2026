import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import type {
  BookSourceDownloadEvent,
  BookSourceImportPreviewItem,
  BookSourceListItem,
  BookSourceRecord,
  BookSourceSearchEvent,
  BookDetail,
  BookChapter,
  SearchBookItem,
} from "@shared/bookSource/types";
import { parseBookSourceJson } from "@shared/bookSource/types";
import { appPrompt } from "../../services/appDialog";

/** IPC 只能传递可结构化克隆的纯对象，需剥离 Vue 响应式代理 */
function ipcPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDetailLastChapter(raw: string | undefined): string {
  return raw?.replace(/[·•][^\n]*$/, "").trim() ?? "";
}

function isDateOnlyLastChapter(raw: string | undefined): boolean {
  const s = raw?.trim() ?? "";
  return /^\d{4}[./-]\d{1,2}[./-]\d{1,2}(\s+\d{1,2}:\d{2})?$/.test(s);
}

export function useBookSourceApi() {
  const api = window.colorTxt;

  async function listSources(): Promise<BookSourceListItem[]> {
    return api.bookSourceList();
  }

  async function getSource(url: string): Promise<BookSourceRecord | null> {
    return api.bookSourceGet(url);
  }

  async function saveSource(source: BookSourceRecord) {
    return api.bookSourceSave(ipcPlain(source));
  }

  async function deleteSources(urls: string[]) {
    return api.bookSourceDelete(urls);
  }

  async function toggleSource(url: string, enabled: boolean) {
    return api.bookSourceToggle(url, enabled);
  }

  async function importFromFile(): Promise<BookSourceImportPreviewItem[]> {
    const r = await api.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "JSON", extensions: ["json"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    if (r.canceled || !r.filePaths.length) return [];
    const read = await api.bookSourceReadFile(r.filePaths[0]);
    if (!read.ok || !read.text) return [];
    const sources = parseBookSourceJson(read.text);
    return api.bookSourceImportPreview(sources);
  }

  async function importFromNetwork(): Promise<BookSourceImportPreviewItem[]> {
    const url = await appPrompt("", {
      title: "网络导入",
      placeholder: "URL",
    });
    if (!url?.trim()) return [];
    const res = await api.bookSourceFetchUrl(url.trim());
    if (!res.ok || !res.text) throw new Error(res.message ?? "加载失败");
    const sources = parseBookSourceJson(res.text);
    return api.bookSourceImportPreview(sources);
  }

  async function commitImport(payload: {
    addUrls: string[];
    updateUrls: string[];
    sources: BookSourceRecord[];
  }) {
    return api.bookSourceImportCommit(ipcPlain(payload));
  }

  async function reorderSource(url: string, position: "top" | "bottom") {
    return api.bookSourceReorder(url, position);
  }

  async function applySourceCustomOrders(
    updates: Array<{ url: string; customOrder: number }>,
  ) {
    return api.bookSourceApplyCustomOrders(ipcPlain(updates));
  }

  return {
    listSources,
    getSource,
    saveSource,
    deleteSources,
    toggleSource,
    reorderSource,
    applySourceCustomOrders,
    importFromFile,
    importFromNetwork,
    commitImport,
  };
}

export function useBookSourceSearch() {
  const searching = ref(false);
  const loadingMore = ref(false);
  const searchHasMore = ref(false);
  const searchPage = ref(1);
  const searchPhase = ref<"searching" | "completed" | "stopped" | null>(null);
  const searchKey = ref("");
  const progress = ref({ completed: 0, total: 0 });
  const results = shallowRef<SearchBookItem[]>([]);
  const searchLogs = ref<string[]>([]);
  const searchSourceErrors = ref<string[]>([]);
  const searchSourceStats = ref<
    Array<{
      sourceName: string;
      sourceUrl: string;
      itemCount: number;
      failed: boolean;
    }>
  >([]);
  let searchId = "";
  let searchSeq = 0;
  let unsub: (() => void) | null = null;

  const pageLoading = computed(() => searching.value || loadingMore.value);

  function reset() {
    results.value = [];
    progress.value = { completed: 0, total: 0 };
    searchLogs.value = [];
    searchSourceErrors.value = [];
    searchSourceStats.value = [];
    searchHasMore.value = false;
    loadingMore.value = false;
    searchPage.value = 1;
  }

  async function search(
    key: string,
    options?: { sourceUrls?: string[]; precisionSearch?: boolean },
  ) {
    const k = key.trim();
    if (!k) return;
    const seq = ++searchSeq;

    unsub?.();
    unsub = null;
    if (searchId) {
      await window.colorTxt.bookSourceSearchCancel(searchId);
      searchId = "";
    }

    searching.value = true;
    searchPhase.value = "searching";
    searchKey.value = k;
    reset();

    const searchOptions =
      options?.sourceUrls?.length || options?.precisionSearch
        ? {
            ...(options.sourceUrls?.length
              ? { sourceUrls: options.sourceUrls }
              : {}),
            ...(options.precisionSearch ? { precisionSearch: true } : {}),
          }
        : undefined;

    const r = await window.colorTxt.bookSourceSearch(k, searchOptions);
    if (seq !== searchSeq) return;

    const currentSearchId = r.searchId;
    if (!currentSearchId) {
      searching.value = false;
      searchPhase.value = null;
      return;
    }
    searchId = currentSearchId;

    unsub = window.colorTxt.onBookSourceSearchEvent((ev: BookSourceSearchEvent) => {
      if (ev.searchId !== currentSearchId) return;
      if (ev.type === "progress") {
        progress.value = {
          completed: Math.max(progress.value.completed, ev.completed),
          total: ev.total,
        };
      } else if (ev.type === "result") {
        results.value = ev.items;
      } else if (ev.type === "sourceDone") {
        searchSourceStats.value = [
          ...searchSourceStats.value,
          {
            sourceName: ev.sourceName,
            sourceUrl: ev.sourceUrl,
            itemCount: ev.itemCount,
            failed: ev.failed,
          },
        ];
        if (ev.logs?.length) {
          searchLogs.value = [...searchLogs.value, ...ev.logs];
        }
        if (ev.error) {
          searchSourceErrors.value = [
            ...searchSourceErrors.value,
            `[${ev.sourceName}] ${ev.error}`,
          ];
        }
      } else if (ev.type === "loadMoreStart") {
        loadingMore.value = true;
        progress.value = { completed: 0, total: ev.total };
      } else if (ev.type === "done") {
        searching.value = false;
        searchPhase.value = ev.cancelled ? "stopped" : "completed";
        searchHasMore.value = ev.hasMore === true;
      } else if (ev.type === "loadMoreDone") {
        loadingMore.value = false;
        searchHasMore.value = ev.hasMore;
      }
    });
  }

  async function loadMore() {
    if (!searchId || pageLoading.value || !searchHasMore.value) {
      return;
    }
    loadingMore.value = true;
    searchPage.value += 1;
    progress.value = { completed: 0, total: 0 };
    const r = await window.colorTxt.bookSourceSearchLoadMore(searchId);
    if (!r.ok) {
      loadingMore.value = false;
      searchPage.value = Math.max(1, searchPage.value - 1);
    }
  }

  async function cancel() {
    searchSeq += 1;
    unsub?.();
    unsub = null;
    if (searchId) {
      await window.colorTxt.bookSourceSearchCancel(searchId);
      searchId = "";
    }
    searching.value = false;
    searchPhase.value = "stopped";
  }

  onBeforeUnmount(() => {
    unsub?.();
    if (searchId) void window.colorTxt.bookSourceSearchCancel(searchId);
  });

  return {
    searching,
    loadingMore,
    pageLoading,
    searchPage,
    searchHasMore,
    searchPhase,
    searchKey,
    progress,
    results,
    searchLogs,
    searchSourceErrors,
    searchSourceStats,
    search,
    loadMore,
    cancel,
    reset,
  };
}

export function useBookSourceDownload(onDone?: (filePath: string) => void) {
  const downloading = ref(false);
  const downloadProgress = ref({
    current: 0,
    total: 0,
    chapterName: "",
    chapterUrl: "",
  });
  let downloadId = "";
  let unsub: (() => void) | null = null;
  let pendingResolve: ((path: string | null) => void) | null = null;

  function finish(path: string | null) {
    downloading.value = false;
    downloadProgress.value = {
      ...downloadProgress.value,
      chapterName: "",
      chapterUrl: "",
    };
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.(path);
  }

  async function download(
    item: SearchBookItem,
    outputDir: string,
    cacheDir?: string,
  ): Promise<string | null> {
    if (downloading.value) return null;
    downloading.value = true;
    downloadProgress.value = {
      current: 0,
      total: 0,
      chapterName: "",
      chapterUrl: "",
    };
    unsub?.();
    return new Promise((resolve) => {
      pendingResolve = resolve;
      unsub = window.colorTxt.onBookSourceDownloadEvent(
        (ev: BookSourceDownloadEvent) => {
          if (ev.downloadId !== downloadId) return;
          if (ev.type === "progress") {
            downloadProgress.value = {
              current: ev.current,
              total: ev.total,
              chapterName: ev.chapterName ?? "",
              chapterUrl: ev.chapterUrl ?? "",
            };
          } else if (ev.type === "done") {
            onDone?.(ev.filePath);
            finish(ev.filePath);
          } else if (ev.type === "error") {
            finish(null);
          }
        },
      );
      void window.colorTxt
        .bookSourceDownload({
          bookUrl: item.bookUrl,
          bookSourceUrl: item.origin,
          name: item.name,
          author: item.author,
          outputDir,
          cacheDir: cacheDir?.trim() || undefined,
        })
        .then((r) => {
          downloadId = r.downloadId;
        })
        .catch(() => {
          finish(null);
        });
    });
  }

  /** 请求停止；主进程丢弃已下内容，不落盘 */
  async function cancel() {
    if (downloadId) await window.colorTxt.bookSourceDownloadCancel(downloadId);
  }

  onBeforeUnmount(() => {
    unsub?.();
    if (downloadId) void window.colorTxt.bookSourceDownloadCancel(downloadId);
    if (pendingResolve) finish(null);
  });

  return { downloading, downloadProgress, download, cancel };
}

export function useBookSourceDetail() {
  const loading = ref(false);
  const error = ref("");
  const logs = ref<string[]>([]);
  const detail = ref<BookDetail | null>(null);
  const chapters = ref<BookChapter[]>([]);

  async function load(item: SearchBookItem) {
    loading.value = true;
    error.value = "";
    logs.value = [];
    detail.value = null;
    chapters.value = [];
    try {
      const infoRes = await window.colorTxt.bookSourceGetBookInfo({
        bookSourceUrl: item.origin,
        bookUrl: item.bookUrl,
        name: item.name,
        author: item.author,
        kind: item.kind,
        wordCount: item.wordCount,
        intro: item.intro,
        lastChapter: item.lastChapter,
        coverUrl: item.coverUrl,
      });
      if (infoRes.logs?.length) logs.value = infoRes.logs;
      if (infoRes.message || !infoRes.detail) {
        error.value = infoRes.message ?? "加载书籍信息失败";
        return;
      }
      detail.value = infoRes.detail;
      const tocRes = await window.colorTxt.bookSourceGetChapterList({
        bookSourceUrl: item.origin,
        bookUrl: infoRes.detail.bookUrl,
        tocUrl: infoRes.detail.tocUrl,
      });
      if (tocRes.logs?.length) logs.value = [...logs.value, ...tocRes.logs];
      if (tocRes.message) {
        error.value = tocRes.message;
        return;
      }
      chapters.value = tocRes.chapters ?? [];
      if (detail.value && chapters.value.length) {
        const firstTitle = chapters.value.find((ch) => !ch.isVolume)?.title?.trim();
        if (firstTitle) {
          const seed = formatDetailLastChapter(detail.value.lastChapter);
          const preferToc = !seed || isDateOnlyLastChapter(seed);
          if (preferToc) {
            detail.value = { ...detail.value, lastChapter: firstTitle };
          }
        }
      }
      if (!chapters.value.length && !error.value && logs.value.length) {
        error.value = "未获取到章节";
      }
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    loading.value = false;
    error.value = "";
    logs.value = [];
    detail.value = null;
    chapters.value = [];
  }

  return { loading, error, logs, detail, chapters, load, reset };
}

export function useBookSourceChapterContent() {
  const loading = ref(false);
  const error = ref("");
  const logs = ref<string[]>([]);
  let loadSeq = 0;

  async function load(payload: {
    bookSourceUrl: string;
    bookUrl: string;
    tocUrl: string;
    name: string;
    author: string;
    chapterUrl: string;
    chapterTitle: string;
    chapterIndex: number;
    nextChapterUrl?: string;
    cacheDir?: string;
  }): Promise<string | null> {
    const seq = ++loadSeq;
    loading.value = true;
    error.value = "";
    logs.value = [];
    try {
      const res = await window.colorTxt.bookSourceGetChapterContent(
        ipcPlain(payload),
      );
      if (seq !== loadSeq) return null;
      if (res.logs?.length) logs.value = res.logs;
      if (res.message) {
        error.value = res.message;
        return null;
      }
      return res.content ?? "";
    } finally {
      if (seq === loadSeq) loading.value = false;
    }
  }

  function cancel() {
    loadSeq += 1;
    loading.value = false;
  }

  onBeforeUnmount(() => cancel());

  return { loading, error, logs, load, cancel };
}

export function newEmptyBookSource(): BookSourceRecord {
  return {
    bookSourceUrl: "",
    bookSourceName: "新书源",
    bookSourceType: 0,
    enabled: true,
    enabledExplore: true,
    enabledCookieJar: true,
    searchUrl: "",
    ruleSearch: {},
    ruleBookInfo: {},
    ruleToc: {},
    ruleContent: {},
    ruleExplore: {},
    lastUpdateTime: Date.now(),
  };
}
