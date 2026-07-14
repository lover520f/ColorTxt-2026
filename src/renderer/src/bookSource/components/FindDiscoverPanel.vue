<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import IconButton from "../../components/IconButton.vue";
import FindBookListItem from "./FindBookListItem.vue";
import EditBookSourcePanel from "./EditBookSourcePanel.vue";
import BookSourceCenterState from "./BookSourceCenterState.vue";
import { icons } from "../../icons";
import {
  useBookSourceApi,
} from "../composables/useBookSource";
import type { BookSourceListItem, ExploreKind, SearchBookItem } from "@shared/bookSource/types";
import { appLog } from "../../services/appDialog";
import { legadoFlexChildStyle } from "@shared/bookSource/legadoFlexStyle";
import { readerTxtLoadingHintText } from "../../constants/appUi";
import "./findBookListShared.css";

const props = defineProps<{
  filter: string;
  active: boolean;
}>();

const emit = defineEmits<{
  openBook: [item: SearchBookItem];
  /** 是否已进入书源分类浏览（用于父级隐藏筛选栏） */
  exploreActiveChange: [active: boolean];
}>();

const { listSources } = useBookSourceApi();

const sources = ref<BookSourceListItem[]>([]);
const expandedUrl = ref<string | null>(null);
const kindsByUrl = ref<Map<string, ExploreKind[]>>(new Map());
const kindsFailedByUrl = ref<Map<string, boolean>>(new Map());
const kindsLogsByUrl = ref<Map<string, string[]>>(new Map());
const kindsLoading = ref<string | null>(null);

const exploreShow = ref<{
  sourceUrl: string;
  sourceName: string;
  kindTitle: string;
  exploreUrl: string;
} | null>(null);
const explorePaneOpen = ref(false);
const exploreBooks = ref<SearchBookItem[]>([]);
const exploreLoading = ref(false);
const exploreLoadingMore = ref(false);
const explorePage = ref(1);
const exploreHasMore = ref(true);
const exploreError = ref("");
const exploreLogs = ref<string[]>([]);
/** 发现分类书籍请求序号：切换分类/返回时递增，丢弃过期响应 */
let exploreRequestSeq = 0;

function bumpExploreRequestSeq(): number {
  exploreRequestSeq += 1;
  return exploreRequestSeq;
}

function isExploreContextMatch(
  captured: { sourceUrl: string; exploreUrl: string },
): boolean {
  const cur = exploreShow.value;
  return (
    cur !== null &&
    cur.sourceUrl === captured.sourceUrl &&
    cur.exploreUrl === captured.exploreUrl
  );
}
const hasExploreLogs = computed(() => exploreLogs.value.length > 0);
/** 有错误或已有日志时显示右上角日志入口 */
const showExploreLogBtn = computed(
  () => !!exploreError.value || hasExploreLogs.value,
);
const showEdit = ref(false);
const editingUrl = ref<string | null>(null);
const discoverBodyRef = ref<HTMLElement | null>(null);
const sourceItemEls = new Map<string, HTMLElement>();

function setSourceItemEl(url: string, el: Element | null) {
  if (el) sourceItemEls.set(url, el as HTMLElement);
  else sourceItemEls.delete(url);
}

const DISCOVER_SCROLL_TOP_GAP = 10;

function scrollExpandedSourceToTop(url: string) {
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const body = discoverBodyRef.value;
        const item = sourceItemEls.get(url);
        if (!body || !item) return;
        const head = item.querySelector(".findDiscoverSourceHead") as HTMLElement | null;
        const target = head ?? item;
        const delta =
          target.getBoundingClientRect().top -
          body.getBoundingClientRect().top -
          DISCOVER_SCROLL_TOP_GAP;
        if (Math.abs(delta) < 1) return;
        body.scrollTo({
          top: Math.max(0, body.scrollTop + delta),
          behavior: "smooth",
        });
      });
    });
  });
}

async function scrollAfterExpand(source: BookSourceListItem) {
  const url = source.bookSourceUrl;
  await loadKinds(source);
  if (expandedUrl.value !== url) return;
  scrollExpandedSourceToTop(url);
}

const filteredSources = computed(() => {
  const q = props.filter.trim();
  let list = sources.value.filter(
    (s) => s.hasExploreUrl && s.enabledExplore,
  );
  if (!q) return list;
  if (q.startsWith("group:")) {
    const g = q.slice(6).trim();
    return list.filter((s) => (s.bookSourceGroup ?? "") === g);
  }
  const lower = q.toLowerCase();
  return list.filter(
    (s) =>
      s.bookSourceName.toLowerCase().includes(lower) ||
      (s.bookSourceGroup ?? "").toLowerCase().includes(lower),
  );
});

function kindChipStyle(kind: ExploreKind): Record<string, string> {
  return legadoFlexChildStyle(kind.style);
}

const showExploreList = computed(() => explorePaneOpen.value && exploreShow.value !== null);

watch(
  showExploreList,
  (active) => {
    emit("exploreActiveChange", active);
  },
  { immediate: true },
);

async function refreshSources() {
  sources.value = await listSources();
}

function isKindsErrorKind(kind: ExploreKind): boolean {
  return kind.title.startsWith("ERROR:");
}

function kindsParseFailed(sourceUrl: string): boolean {
  return kindsFailedByUrl.value.get(sourceUrl) === true;
}

function mergeKindsLogs(existing: string[], extra: string): string[] {
  const detail = extra.trim();
  if (!detail) return existing;
  if (existing.some((line) => line.includes(detail))) return existing;
  return [...existing, detail];
}

function kindsIsEmpty(sourceUrl: string): boolean {
  const kinds = kindsByUrl.value.get(sourceUrl);
  return kinds !== undefined && kinds.length === 0;
}

function showKindsLogBtn(sourceUrl: string): boolean {
  if (expandedUrl.value !== sourceUrl) return false;
  if ((kindsLogsByUrl.value.get(sourceUrl) ?? []).length) return true;
  if (kindsParseFailed(sourceUrl)) return true;
  if (kindsLoading.value !== sourceUrl && kindsIsEmpty(sourceUrl)) return true;
  return false;
}

async function loadKinds(source: BookSourceListItem, force = false) {
  const url = source.bookSourceUrl;
  if (!force) {
    const cached = kindsByUrl.value.get(url);
    if (cached !== undefined && cached.length > 0) return;
  }
  kindsLoading.value = source.bookSourceUrl;
  try {
    if (force) {
      await window.colorTxt.bookSourceExploreClearKindsCache(source.bookSourceUrl);
    }
    const r = await window.colorTxt.bookSourceExploreKinds(source.bookSourceUrl);
    const rawKinds = r.kinds ?? [];
    const errorKind = rawKinds.find(isKindsErrorKind);
    const validKinds = rawKinds.filter((k) => !isKindsErrorKind(k));
    let logs = [...(r.logs ?? [])];
    if (errorKind) {
      const detail =
        errorKind.url?.trim() ||
        errorKind.title.replace(/^ERROR:/, "").trim();
      logs = mergeKindsLogs(logs, detail);
    } else if (r.message?.trim() && !validKinds.length) {
      logs = mergeKindsLogs(logs, r.message.trim());
    }

    const nextKinds = new Map(kindsByUrl.value);
    nextKinds.set(source.bookSourceUrl, validKinds);
    kindsByUrl.value = nextKinds;

    const nextFailed = new Map(kindsFailedByUrl.value);
    nextFailed.set(
      source.bookSourceUrl,
      Boolean(errorKind) ||
        (!!r.message?.trim() && !validKinds.length) ||
        (!validKinds.length && logs.length > 0),
    );
    kindsFailedByUrl.value = nextFailed;

    const nextLogs = new Map(kindsLogsByUrl.value);
    nextLogs.set(source.bookSourceUrl, logs);
    kindsLogsByUrl.value = nextLogs;
  } finally {
    if (kindsLoading.value === url) {
      kindsLoading.value = null;
    }
  }
}

function toggleExpand(source: BookSourceListItem) {
  if (expandedUrl.value === source.bookSourceUrl) {
    expandedUrl.value = null;
    return;
  }
  expandedUrl.value = source.bookSourceUrl;
  void scrollAfterExpand(source);
}

async function onKindClick(source: BookSourceListItem, kind: ExploreKind) {
  if (!kind.url?.trim()) return;
  const seq = bumpExploreRequestSeq();
  exploreShow.value = {
    sourceUrl: source.bookSourceUrl,
    sourceName: source.bookSourceName,
    kindTitle: kind.title,
    exploreUrl: kind.url,
  };
  explorePaneOpen.value = true;
  exploreBooks.value = [];
  explorePage.value = 1;
  exploreHasMore.value = true;
  exploreError.value = "";
  exploreLogs.value = [];
  exploreLoading.value = false;
  exploreLoadingMore.value = false;
  await loadExplorePage(false, seq);
}

async function onShowExploreLogs() {
  const text = exploreLogs.value.length
    ? exploreLogs.value.join("\n\n")
    : "（暂无日志）";
  await appLog(text);
}

async function onShowKindsLogs(sourceUrl: string) {
  const logs = kindsLogsByUrl.value.get(sourceUrl) ?? [];
  const text = logs.length ? logs.join("\n\n") : "（暂无日志）";
  await appLog(text);
}

async function loadExplorePage(append: boolean, requestSeq?: number) {
  const show = exploreShow.value;
  if (!show) return;
  const seq = requestSeq ?? exploreRequestSeq;
  const captured = {
    sourceUrl: show.sourceUrl,
    exploreUrl: show.exploreUrl,
  };
  const capturedPage = explorePage.value;

  function isStale(): boolean {
    if (seq !== exploreRequestSeq) return true;
    if (!isExploreContextMatch(captured)) return true;
    if (append && explorePage.value !== capturedPage) return true;
    return false;
  }

  if (append) exploreLoadingMore.value = true;
  else exploreLoading.value = true;
  try {
    const r = await window.colorTxt.bookSourceExploreBooks({
      sourceUrl: captured.sourceUrl,
      exploreUrl: captured.exploreUrl,
      page: capturedPage,
    });
    if (isStale()) return;
    if (r.logs?.length) exploreLogs.value = r.logs;
    const items = r.items ?? [];
    if (!append && !items.length && (r.message || r.logs?.length)) {
      exploreError.value = r.message?.trim() || "加载失败";
      exploreHasMore.value = false;
      exploreBooks.value = [];
      return;
    }
    exploreError.value = "";
    if (append) {
      const seen = new Set(exploreBooks.value.map((b) => b.id));
      let added = 0;
      for (const item of items) {
        if (!seen.has(item.id)) {
          exploreBooks.value.push(item);
          added += 1;
        }
      }
      if (items.length === 0 || added === 0) {
        exploreHasMore.value = false;
      } else {
        explorePage.value += 1;
        exploreHasMore.value = true;
      }
    } else {
      exploreBooks.value = items;
      if (items.length === 0) exploreHasMore.value = false;
      else {
        explorePage.value += 1;
        exploreHasMore.value = true;
      }
    }
  } catch (e) {
    if (isStale()) return;
    const msg = e instanceof Error ? e.message : String(e);
    exploreError.value = msg;
    exploreHasMore.value = false;
  } finally {
    if (seq === exploreRequestSeq) {
      exploreLoading.value = false;
      exploreLoadingMore.value = false;
    }
  }
}

function onExploreScroll(ev: Event) {
  const el = ev.target as HTMLElement;
  if (
    !exploreShow.value ||
    exploreLoading.value ||
    exploreLoadingMore.value ||
    !exploreHasMore.value
  ) {
    return;
  }
  if (el.scrollHeight <= el.clientHeight + 48) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
    void loadExplorePage(true);
  }
}

function backFromExplore() {
  bumpExploreRequestSeq();
  explorePaneOpen.value = false;
  exploreLoading.value = false;
  exploreLoadingMore.value = false;
}

function onOpenBook(item: SearchBookItem) {
  emit("openBook", item);
}

async function reloadKindsForUrl(url: string) {
  const nextKinds = new Map(kindsByUrl.value);
  nextKinds.delete(url);
  kindsByUrl.value = nextKinds;
  const nextFailed = new Map(kindsFailedByUrl.value);
  nextFailed.delete(url);
  kindsFailedByUrl.value = nextFailed;
  const nextLogs = new Map(kindsLogsByUrl.value);
  nextLogs.delete(url);
  kindsLogsByUrl.value = nextLogs;
  const source = sources.value.find((s) => s.bookSourceUrl === url);
  if (source) await loadKinds(source, true);
}

function onEditSource(source: BookSourceListItem) {
  editingUrl.value = source.bookSourceUrl;
  showEdit.value = true;
}

async function onEditDone() {
  const url = editingUrl.value;
  showEdit.value = false;
  editingUrl.value = null;
  await refreshSources();
  if (!url || expandedUrl.value !== url) return;
  await reloadKindsForUrl(url);
}

watch(
  () => props.active,
  (on) => {
    if (on) void refreshSources();
  },
  { immediate: true },
);
</script>

<template>
  <div class="findDiscoverShell">
    <div
      v-show="showExploreList && exploreShow"
      class="findDiscoverExplorePane"
      :class="{ 'findDiscoverExplorePane--shadow': showExploreList && exploreShow }"
    >
      <header class="findDiscoverSubHead">
        <IconButton
          class="findDiscoverBackBtn"
          :icon-html="icons.back"
          title="返回"
          aria-label="返回"
          @click="backFromExplore"
        />
        <nav v-if="exploreShow" class="findDiscoverBreadcrumb" aria-label="发现分类">
          <span class="findDiscoverBreadcrumbSource">{{ exploreShow.sourceName }}</span>
          <span class="findDiscoverBreadcrumbSep" aria-hidden="true">/</span>
          <span class="findDiscoverBreadcrumbCurrent">{{ exploreShow.kindTitle }}</span>
        </nav>
        <IconButton
          v-if="showExploreLogBtn"
          class="findDiscoverSubLogBtn"
          :icon-html="icons.info"
          title="日志"
          aria-label="日志"
          @click="onShowExploreLogs"
        />
      </header>
      <div class="findDiscoverExploreBodyWrap">
        <BookSourceCenterState v-if="exploreLoading">
          {{ readerTxtLoadingHintText }}
        </BookSourceCenterState>
        <BookSourceCenterState v-else-if="exploreError" error>
          加载失败
        </BookSourceCenterState>
        <BookSourceCenterState v-else-if="!exploreBooks.length">
          暂无书籍
        </BookSourceCenterState>
        <div v-else class="findDiscoverExploreBody" @scroll="onExploreScroll">
          <ul class="findBookResultsList">
            <FindBookListItem
              v-for="item in exploreBooks"
              :key="item.id"
              :item="item"
              :show-origin="false"
              @click="onOpenBook"
            />
          </ul>
          <p v-if="exploreLoadingMore" class="findDiscoverHint">加载更多…</p>
          <p v-else-if="exploreBooks.length && !exploreHasMore" class="findDiscoverHint">
            没有更多了
          </p>
        </div>
      </div>
    </div>

    <div ref="discoverBodyRef" v-show="!showExploreList" class="findDiscoverBody">
        <p v-if="!filteredSources.length" class="findDiscoverHint">
          没有可用的发现书源
        </p>
        <ul v-else class="findDiscoverSourceList">
          <li
            v-for="source in filteredSources"
            :key="source.bookSourceUrl"
            :ref="(el) => setSourceItemEl(source.bookSourceUrl, el as Element | null)"
            class="findDiscoverSource"
          >
            <div class="findDiscoverSourceCard">
              <div
                class="findDiscoverSourceHead"
                role="button"
                tabindex="0"
                @click="toggleExpand(source)"
                @keydown.enter.prevent="toggleExpand(source)"
              >
                <span class="findDiscoverSourceName">{{ source.bookSourceName }}</span>
                <div class="findDiscoverSourceHeadEnd">
                  <IconButton
                    v-if="showKindsLogBtn(source.bookSourceUrl)"
                    class="findDiscoverSourceBtn"
                    :class="{
                      'findDiscoverSourceBtn--warning': kindsParseFailed(
                        source.bookSourceUrl,
                      ),
                    }"
                    :icon-html="icons.info"
                    title="日志"
                    aria-label="日志"
                    @click.stop="onShowKindsLogs(source.bookSourceUrl)"
                  />
                  <IconButton
                    v-if="expandedUrl === source.bookSourceUrl"
                    :icon-html="icons.edit"
                    title="编辑"
                    aria-label="编辑"
                    class="findDiscoverSourceBtn"
                    @click.stop="onEditSource(source)"
                  />
                  <span
                    class="findDiscoverSourceArrow"
                    :class="{
                      'findDiscoverSourceArrow--open':
                        expandedUrl === source.bookSourceUrl,
                    }"
                    aria-hidden="true"
                    v-html="icons.foldChevron"
                  />
                </div>
              </div>
              <div
                v-if="expandedUrl === source.bookSourceUrl"
                class="findDiscoverKinds"
              >
                <p v-if="kindsLoading === source.bookSourceUrl" class="findDiscoverKindsHint">
                  加载分类…
                </p>
                <p
                  v-else-if="kindsParseFailed(source.bookSourceUrl)"
                  class="findDiscoverKindsHint findDiscoverKindsHint--error"
                >
                  分类加载失败
                </p>
                <p
                  v-else-if="!(kindsByUrl.get(source.bookSourceUrl) ?? []).length"
                  class="findDiscoverKindsHint"
                >
                  暂无分类
                </p>
                <template v-else>
                  <template
                    v-for="(kind, idx) in kindsByUrl.get(source.bookSourceUrl) ?? []"
                    :key="`${kind.title}-${idx}`"
                  >
                    <div v-if="!kind.url?.trim()" class="findDiscoverKindSection">
                      {{ kind.title }}
                    </div>
                    <button
                      v-else
                      type="button"
                      class="findDiscoverKindChip"
                      :style="kindChipStyle(kind)"
                      @click="onKindClick(source, kind)"
                    >
                      {{ kind.title }}
                    </button>
                  </template>
                </template>
              </div>
            </div>
          </li>
        </ul>
    </div>

    <EditBookSourcePanel
      v-model="showEdit"
      :source-url="editingUrl"
      initial-tab="explore"
      @done="onEditDone"
    />
  </div>
</template>

<style scoped>
.findDiscoverShell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}
.findDiscoverExplorePane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.findDiscoverExploreBodyWrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg);
}
.findDiscoverBody,
.findDiscoverExploreBody {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  background: var(--bg);
}
.findDiscoverBody {
  display: flex;
  flex-direction: column;
}
.findDiscoverHint {
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  padding: 24px 0;
  margin: 0;
}
.findDiscoverSourceList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.findDiscoverSource {
  margin: 0;
}
.findDiscoverSourceCard {
  display: flex;
  flex-direction: column;
  background: var(--panel);
}
.findDiscoverSourceCard:has(.findDiscoverKinds) {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.findDiscoverSourceHead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  /* cursor: pointer; */
  user-select: none;
  transition: background 0.12s ease;
}
.findDiscoverSourceCard:has(.findDiscoverKinds) .findDiscoverSourceHead {
  border: none;
  border-radius: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
}
.findDiscoverSourceHead:hover,
.findDiscoverSourceCard:has(.findDiscoverKinds) .findDiscoverSourceHead {
  background: var(--icon-btn-bg-hover);
}
.findDiscoverSourceHeadEnd {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}
.findDiscoverSourceBtn {
  width: 26px;
  height: 26px;
  background: transparent !important;
}
.findDiscoverSourceBtn:hover :deep(.icon) {
  color: var(--accent) !important;
}
.findDiscoverSourceBtn--warning :deep(.icon),
.findDiscoverSourceBtn--warning :deep(svg path) {
  color: var(--warning) !important;
}
.findDiscoverSourceBtn--warning:hover :deep(.icon),
.findDiscoverSourceBtn--warning:hover :deep(svg path) {
  color: var(--warning-hover) !important;
}
.findDiscoverSourceName {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
}
.findDiscoverSourceCard:has(.findDiscoverKinds) .findDiscoverSourceName {
  font-weight: 600;
}
.findDiscoverSourceArrow {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--muted) 85%, var(--fg));
  transform: rotate(-90deg);
  transition: transform 0.22s ease;
}
.findDiscoverSourceArrow :deep(svg) {
  width: 10px;
  height: 10px;
  display: block;
}
.findDiscoverSourceArrow :deep(svg path) {
  fill: currentColor;
}
.findDiscoverSourceArrow--open {
  transform: rotate(0deg);
}
.findDiscoverKinds {
  display: flex;
  flex-wrap: wrap;
  padding: 3px 10px 10px;
  background: var(--panel);
}
.findDiscoverKindsHint {
  flex: 1 1 100%;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  padding: 8px 0 4px;
  margin: 0;
}
.findDiscoverKindsHint--error {
  color: var(--fg);
}
.findDiscoverKindSection {
  flex: 0 1 100%;
  box-sizing: border-box;
  width: 100%;
  margin: 3px;
  text-align: center;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.findDiscoverKindChip {
  box-sizing: border-box;
  min-width: 0;
  margin: 3px;
  padding: 4px 12px;
  border: none;
  border-radius: 16px;
  background: var(--btn-bg);
  color: var(--fg);
  font-size: 14px;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  transition: background 0.12s ease, color 0.12s ease;
  /* 作为 flex 子项时占满分配宽度 */
  align-self: stretch;
}
.findDiscoverKindChip:hover {
  background: color-mix(in srgb, var(--accent) 18%, var(--btn-bg, rgba(0, 0, 0, 0.06)));
  color: var(--accent);
}
.findDiscoverSubHead {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
}
.findDiscoverBackBtn {
  flex-shrink: 0;
}
.findDiscoverBreadcrumb {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.4;
}
.findDiscoverBreadcrumbSource {
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  user-select: none;
}
.findDiscoverBreadcrumbSep {
  margin: 0 8px;
  color: var(--muted);
  flex-shrink: 0;
  user-select: none;
}
.findDiscoverBreadcrumbCurrent {
  color: var(--fg);
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.findDiscoverSubLogBtn {
  margin-left: auto;
  flex-shrink: 0;
}
</style>
