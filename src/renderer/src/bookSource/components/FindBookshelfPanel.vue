<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppCheckbox from "../../components/AppCheckbox.vue";
import IconButton from "../../components/IconButton.vue";
import AppShellMenuTeleport from "../../components/AppShellMenuTeleport.vue";
import FindBookshelfListItem from "./FindBookshelfListItem.vue";
import { useFindBookBookshelf } from "../composables/useFindBookBookshelf";
import { useBookshelfCoverUrls } from "../composables/useBookshelfCoverUrls";
import { useBookshelfLastReadTitles } from "../composables/useBookshelfLastReadTitles";
import { useBookshelfUpdate } from "../composables/useBookshelfUpdate";
import { useSortableReorder } from "../../composables/useSortableReorder";
import { useAnchoredAppShellMenu } from "../../composables/useAnchoredAppShellMenu";
import { appConfirm } from "../../services/appDialog";
import { appToast } from "../../services/appToast";
import { icons } from "../../icons";
import type { SearchBookItem } from "@shared/bookSource/types";
import {
  bookshelfBookKey,
  type BookshelfBook,
} from "../findBookBookshelf";
import {
  isBookshelfManualSort,
  reorderBookshelfManual,
  sortBookshelfBooks,
  type BookshelfSortMode,
} from "../findBookshelfSort";
import "./findBookListShared.css";

const props = defineProps<{
  active: boolean;
  filter?: string;
  sortMode: BookshelfSortMode;
}>();

const emit = defineEmits<{
  readBook: [item: SearchBookItem];
  openBookInfo: [item: SearchBookItem];
  managingChange: [managing: boolean];
}>();

const { books, refresh, setOrder, remove, setCanUpdate, applyBooks } =
  useFindBookBookshelf();
const { getCoverUrl, retryCover } = useBookshelfCoverUrls(books);
const { getLastReadText } = useBookshelfLastReadTitles(
  books,
  () => props.active,
  refresh,
);
const { isAnyUpdating, isUpdating, updateBook, updateBooks } = useBookshelfUpdate(
  applyBooks,
);

const managing = ref(false);
const selected = ref(new Set<string>());
const coverFailedIds = ref<Record<string, true>>({});
const bookshelfListRef = ref<HTMLElement | null>(null);
const rowMenuAnchor = ref<HTMLElement | null>(null);
const rowMenuItem = ref<BookshelfBook | null>(null);
const rowMenu = useAnchoredAppShellMenu({
  anchor: rowMenuAnchor,
  placement: "below-end",
  widthPx: 168,
});
const {
  open: rowMenuOpen,
  left: rowMenuLeft,
  top: rowMenuTop,
  openMenu: openRowMenu,
  closeMenu: closeRowMenu,
  panelRef: rowMenuPanelRef,
} = rowMenu;

const footerMoreBtnRef = ref<HTMLElement | null>(null);
const footerMoreMenu = useAnchoredAppShellMenu({
  anchor: footerMoreBtnRef,
  placement: "above-end",
  widthPx: 140,
});
const {
  open: footerMoreOpen,
  left: footerMoreLeft,
  top: footerMoreTop,
  toggleMenu: toggleFooterMoreMenu,
  closeMenu: closeFooterMoreMenu,
  panelRef: footerMorePanelRef,
} = footerMoreMenu;

function bindRowMenuPanel(el: HTMLElement | null) {
  rowMenuPanelRef.value = el;
}

function bindFooterMorePanel(el: HTMLElement | null) {
  footerMorePanelRef.value = el;
}

function bookKey(book: BookshelfBook): string {
  return bookshelfBookKey(book.bookUrl, book.origin);
}

const filteredBooks = computed(() => {
  const q = props.filter?.trim().toLowerCase() ?? "";
  if (!q) return books.value;
  return books.value.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q),
  );
});

const displayBooks = computed(() =>
  sortBookshelfBooks(filteredBooks.value, props.sortMode),
);

const canDragReorder = computed(
  () =>
    props.active &&
    !managing.value &&
    !props.filter?.trim() &&
    isBookshelfManualSort(props.sortMode) &&
    displayBooks.value.length > 1,
);

const rowMenuCanUpdate = computed(() => rowMenuItem.value?.canUpdate !== false);

const selectedCount = computed(() => {
  let n = 0;
  for (const book of displayBooks.value) {
    if (selected.value.has(bookKey(book))) n += 1;
  }
  return n;
});
const allDisplaySelected = computed(
  () =>
    displayBooks.value.length > 0 &&
    displayBooks.value.every((b) => selected.value.has(bookKey(b))),
);
const selectAllLabel = computed(() =>
  allDisplaySelected.value ? "取消全选" : "全选",
);
const selectAllIndeterminate = computed(
  () => selectedCount.value > 0 && !allDisplaySelected.value,
);

useSortableReorder({
  containerRef: bookshelfListRef,
  draggable: "li",
  active: computed(() => props.active),
  enabled: canDragReorder,
  itemCount: computed(() => displayBooks.value.length),
  onReorder(from, to) {
    if (!isBookshelfManualSort(props.sortMode)) return;
    setOrder(reorderBookshelfManual(books.value, from, to));
  },
});

const showEmptyShelf = computed(
  () => !books.value.length && !props.filter?.trim(),
);

const showNoFilterMatch = computed(
  () =>
    !!props.filter?.trim() &&
    books.value.length > 0 &&
    filteredBooks.value.length === 0,
);

watch(books, (next) => {
  if (selected.value.size === 0) return;
  const valid = new Set(next.map(bookKey));
  const pruned = new Set<string>();
  for (const key of selected.value) {
    if (valid.has(key)) pruned.add(key);
  }
  selected.value = pruned;
});

watch(
  () => props.active,
  (active) => {
    if (!active) exitManage();
  },
);

function clearSelection() {
  selected.value = new Set();
}

function enterManage() {
  managing.value = true;
  clearSelection();
  closeRowMenu();
  emit("managingChange", true);
}

function exitManage() {
  managing.value = false;
  clearSelection();
  closeRowMenu();
  closeFooterMoreMenu();
  emit("managingChange", false);
}

function isSelected(book: BookshelfBook): boolean {
  return selected.value.has(bookKey(book));
}

function toggleSelected(book: BookshelfBook) {
  const key = bookKey(book);
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selected.value = next;
}

function selectAllVisible() {
  selected.value = new Set(displayBooks.value.map(bookKey));
}

function invertSelect() {
  const visibleKeys = displayBooks.value.map(bookKey);
  const visible = new Set(visibleKeys);
  const next = new Set<string>();
  for (const key of selected.value) {
    if (!visible.has(key)) next.add(key);
  }
  for (const key of visibleKeys) {
    if (!selected.value.has(key)) next.add(key);
  }
  selected.value = next;
}

function onToggleSelectAll() {
  if (allDisplaySelected.value) clearSelection();
  else selectAllVisible();
}

function selectedBooksInDisplayOrder(): BookshelfBook[] {
  return displayBooks.value.filter((b) => selected.value.has(bookKey(b)));
}

async function onCoverError(item: BookshelfBook) {
  const ok = await retryCover(item);
  if (!ok) {
    coverFailedIds.value = { ...coverFailedIds.value, [item.id]: true };
  } else {
    const { [item.id]: _, ...rest } = coverFailedIds.value;
    coverFailedIds.value = rest;
  }
}

function onItemClick(item: BookshelfBook) {
  if (managing.value) {
    toggleSelected(item);
    return;
  }
  emit("readBook", item);
}

function onRowMoreClick(item: BookshelfBook, e: MouseEvent) {
  rowMenuItem.value = item;
  rowMenuAnchor.value = e.currentTarget as HTMLElement;
  void openRowMenu();
}

async function onRowMenuUpdate() {
  const item = rowMenuItem.value;
  closeRowMenu();
  if (!item) return;
  if (item.canUpdate === false) {
    appToast("该书已禁止更新", { kind: "warning" });
    return;
  }
  const ok = await updateBook(item);
  appToast(ok ? "更新完成" : "更新失败", { kind: ok ? "success" : "warning" });
}

function onRowMenuBookInfo() {
  const item = rowMenuItem.value;
  closeRowMenu();
  if (!item) return;
  emit("openBookInfo", item);
}

function onRowMenuToggleCanUpdate() {
  const item = rowMenuItem.value;
  closeRowMenu();
  if (!item) return;
  const next = item.canUpdate === false;
  setCanUpdate(item.bookUrl, item.origin, next);
}

async function removeBook(item: BookshelfBook, skipConfirm = false) {
  if (!skipConfirm) {
    const ok = await appConfirm(`确定从书架移除「${item.name}」？`);
    if (!ok) return false;
  }
  remove(item.bookUrl, item.origin);
  const key = bookKey(item);
  if (selected.value.has(key)) {
    const next = new Set(selected.value);
    next.delete(key);
    selected.value = next;
  }
  return true;
}

async function onRowMenuRemove() {
  const item = rowMenuItem.value;
  closeRowMenu();
  if (!item) return;
  const ok = await removeBook(item);
  if (ok) appToast("已从书架移除", { kind: "success", duration: 1200 });
}

async function onRowRemove(item: BookshelfBook) {
  const ok = await removeBook(item);
  if (ok) appToast("已从书架移除", { kind: "success", duration: 1200 });
}

async function onBatchDelete() {
  const list = selectedBooksInDisplayOrder();
  if (!list.length) return;
  const ok = await appConfirm(`是否删除选中的 ${list.length} 本书？`);
  if (!ok) return;
  for (const book of list) {
    remove(book.bookUrl, book.origin);
  }
  clearSelection();
  appToast(`已移除 ${list.length} 本书`, { kind: "success", duration: 1200 });
}

function onBatchSetCanUpdate(canUpdate: boolean) {
  closeFooterMoreMenu();
  const list = selectedBooksInDisplayOrder();
  if (!list.length) return;
  for (const book of list) {
    setCanUpdate(book.bookUrl, book.origin, canUpdate);
  }
  appToast(canUpdate ? "已允许更新" : "已禁止更新", {
    kind: "success",
    duration: 1200,
  });
}

async function updateAll() {
  if (!books.value.length || isAnyUpdating.value) return;
  await updateBooks(books.value);
  appToast("书架更新完成", { kind: "success" });
}

defineExpose({ refresh, updateAll, enterManage, exitManage });
</script>

<template>
  <div class="findBookshelfPanel">
    <div class="findBookshelfBody">
      <div v-if="showEmptyShelf" class="findBookshelfEmpty">
        <p class="findBookshelfEmptyIcon">(; '⌒' )</p>
        <p class="findBookshelfEmptyText">书架还是空的</p>
      </div>
      <div v-else-if="showNoFilterMatch" class="findBookshelfEmpty">
        <p class="findBookshelfEmptyText">无匹配的书籍</p>
      </div>
      <ul v-else ref="bookshelfListRef" class="findBookResultsList">
        <FindBookshelfListItem
          v-for="item in displayBooks"
          :key="item.id"
          :item="item"
          :cover-url="getCoverUrl(item)"
          :force-default-cover="!!coverFailedIds[item.id]"
          :last-read-text="getLastReadText(item)"
          :show-drag-handle="canDragReorder"
          :updating="isUpdating(item)"
          :managing="managing"
          :selected="isSelected(item)"
          @click="onItemClick"
          @cover-error="onCoverError"
          @more="onRowMoreClick"
          @remove="onRowRemove"
        />
      </ul>
    </div>

    <footer v-if="managing" class="findBookshelfFooter">
      <AppCheckbox
        class="findBookshelfFooterSelectAll"
        :model-value="allDisplaySelected"
        :indeterminate="selectAllIndeterminate"
        :aria-label="selectAllLabel"
        @update:model-value="onToggleSelectAll"
      >
        <template #label>
          {{ selectAllLabel }}（{{ selectedCount }}/{{ displayBooks.length }}）
        </template>
      </AppCheckbox>
      <div class="findBookshelfFooterActions">
        <button type="button" class="btn findBookshelfFooterBtn" size="large" @click="invertSelect">
          反选
        </button>
        <button
          type="button"
          class="btn danger findBookshelfFooterBtn"
          size="large"
          :disabled="!selectedCount"
          @click="onBatchDelete"
        >
          删除
        </button>
        <div ref="footerMoreBtnRef" class="findBookshelfFooterMoreWrap">
          <IconButton
            :icon-html="icons.more"
            title="更多"
            aria-label="更多"
            @click="toggleFooterMoreMenu"
          />
          <AppShellMenuTeleport
            v-model:open="footerMoreOpen"
            :left="footerMoreLeft"
            :top="footerMoreTop"
            :on-panel-mount="bindFooterMorePanel"
          >
            <button
              type="button"
              class="appShellMenuItem"
              role="menuitem"
              :disabled="!selectedCount"
              @click="onBatchSetCanUpdate(true)"
            >
              允许更新
            </button>
            <button
              type="button"
              class="appShellMenuItem"
              role="menuitem"
              :disabled="!selectedCount"
              @click="onBatchSetCanUpdate(false)"
            >
              禁止更新
            </button>
          </AppShellMenuTeleport>
        </div>
        <button
          type="button"
          class="btn warning findBookshelfFooterBtn"
          size="large"
          @click="exitManage"
        >
          退出
        </button>
      </div>
    </footer>

    <AppShellMenuTeleport
      v-model:open="rowMenuOpen"
      :left="rowMenuLeft"
      :top="rowMenuTop"
      :on-panel-mount="bindRowMenuPanel"
    >
      <button
        :disabled="!rowMenuCanUpdate"
        type="button"
        class="appShellMenuItem"
        role="menuitem"
        @click="onRowMenuUpdate"
      >
        更新目录
      </button>
      <button type="button" class="appShellMenuItem" role="menuitem" @click="onRowMenuBookInfo">
        书籍信息
      </button>
      <button
        type="button"
        class="appShellMenuItem"
        role="menuitem"
        @click="onRowMenuToggleCanUpdate"
      >
        {{ rowMenuCanUpdate ? "禁止更新" : "允许更新" }}
      </button>
      <button
        type="button"
        class="appShellMenuItem appShellMenuItem--danger"
        role="menuitem"
        @click="onRowMenuRemove"
      >
        从书架移除
      </button>
    </AppShellMenuTeleport>
  </div>
</template>

<style scoped>
.findBookshelfPanel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.findBookshelfBody {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  background: var(--bg);
}
.findBookshelfEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 14px;
  color: var(--text-muted, #888);
  gap: 8px;
}
.findBookshelfEmptyIcon {
  font-size: 28px;
  margin: 0;
}
.findBookshelfEmptyIcon + .findBookshelfEmptyText {
  font-size: 16px;
}
.findBookshelfFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 10px 10px 10px 23px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}
.findBookshelfFooterSelectAll {
  font-size: 14px;
  color: var(--fg, #333);
  flex-shrink: 0;
}
.findBookshelfFooterSelectAll :deep(.appCheckbox__label) {
  font-size: 14px;
  color: var(--fg, #333);
}
.findBookshelfFooterActions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.findBookshelfFooterMoreWrap {
  position: relative;
  flex-shrink: 0;
}
.findBookshelfFooterBtn {
  justify-content: center;
  line-height: 1;
}
:deep(li.sortableRowGhost) {
  opacity: 0.45;
}
:deep(li.sortableRowChosen) {
  box-shadow: 0 2px 12px color-mix(in srgb, var(--accent) 24%, transparent);
}
:deep(.sortableRowHandle) {
  cursor: grab;
}
:deep(.sortableRowHandle:active) {
  cursor: grabbing;
}
</style>
