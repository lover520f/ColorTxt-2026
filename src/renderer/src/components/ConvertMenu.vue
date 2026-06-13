<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import IconButton from "./IconButton.vue";
import convertSvg from "../assets/conver.svg?raw";
import {
  TEXT_CONVERT_WIDTH_EDIT_MENU,
  TEXT_CONVERT_WIDTH_READ_MENU,
  TEXT_CONVERT_ZH_EDIT_MENU,
  TEXT_CONVERT_ZH_READ_MENU,
  isTextConvertDisplayActive,
  type TextConvertWidthMode,
  type TextConvertZhMode,
} from "@shared/textConvertTypes";

const props = withDefaults(
  defineProps<{
    readerEditMode?: boolean;
    disabled?: boolean;
    textConvertZh?: TextConvertZhMode;
    textConvertLetter?: TextConvertWidthMode;
    textConvertDigit?: TextConvertWidthMode;
  }>(),
  {
    readerEditMode: false,
    disabled: false,
    textConvertZh: "off",
    textConvertLetter: "off",
    textConvertDigit: "off",
  },
);

const emit = defineEmits<{
  selectZhRead: [mode: TextConvertZhMode];
  selectLetterRead: [mode: TextConvertWidthMode];
  selectDigitRead: [mode: TextConvertWidthMode];
  applyZhEdit: [mode: Exclude<TextConvertZhMode, "off">];
  applyLetterEdit: [mode: Exclude<TextConvertWidthMode, "off">];
  applyDigitEdit: [mode: Exclude<TextConvertWidthMode, "off">];
}>();

const menuOpen = ref(false);
const menuRootEl = ref<HTMLElement | null>(null);
const zhSubOpen = ref(false);
const letterSubOpen = ref(false);
const digitSubOpen = ref(false);

const buttonTitle = computed(() =>
  props.readerEditMode ? "格式化：转换" : "转换",
);

const displayActive = computed(() =>
  isTextConvertDisplayActive(
    props.textConvertZh,
    props.textConvertLetter,
    props.textConvertDigit,
  ),
);

const zhMenuItems = computed(() =>
  props.readerEditMode
    ? TEXT_CONVERT_ZH_EDIT_MENU
    : TEXT_CONVERT_ZH_READ_MENU,
);

const letterMenuItems = computed(() =>
  props.readerEditMode
    ? TEXT_CONVERT_WIDTH_EDIT_MENU
    : TEXT_CONVERT_WIDTH_READ_MENU,
);

const digitMenuItems = computed(() =>
  props.readerEditMode
    ? TEXT_CONVERT_WIDTH_EDIT_MENU
    : TEXT_CONVERT_WIDTH_READ_MENU,
);

function toggleMenu() {
  if (props.disabled) return;
  menuOpen.value = !menuOpen.value;
  if (!menuOpen.value) closeSubmenus();
}

function closeSubmenus() {
  zhSubOpen.value = false;
  letterSubOpen.value = false;
  digitSubOpen.value = false;
}

function closeMenu() {
  menuOpen.value = false;
  closeSubmenus();
}

function onDocPointerDown(ev: PointerEvent) {
  if (!menuOpen.value) return;
  const root = menuRootEl.value;
  if (!root) return;
  const t = ev.target as Node | null;
  if (t && root.contains(t)) return;
  closeMenu();
}

function isZhItemActive(id: TextConvertZhMode): boolean {
  return !props.readerEditMode && props.textConvertZh === id;
}

function isLetterItemActive(id: TextConvertWidthMode): boolean {
  return !props.readerEditMode && props.textConvertLetter === id;
}

function isDigitItemActive(id: TextConvertWidthMode): boolean {
  return !props.readerEditMode && props.textConvertDigit === id;
}

function onSelectZh(id: TextConvertZhMode) {
  closeMenu();
  if (props.readerEditMode) {
    if (id === "off") return;
    emit("applyZhEdit", id);
    return;
  }
  emit("selectZhRead", id);
}

function onSelectLetter(id: TextConvertWidthMode) {
  closeMenu();
  if (props.readerEditMode) {
    if (id === "off") return;
    emit("applyLetterEdit", id);
    return;
  }
  emit("selectLetterRead", id);
}

function onSelectDigit(id: TextConvertWidthMode) {
  closeMenu();
  if (props.readerEditMode) {
    if (id === "off") return;
    emit("applyDigitEdit", id);
    return;
  }
  emit("selectDigitRead", id);
}

function showDividerBefore(
  item: { dividerBeforeRead?: boolean; dividerBeforeEdit?: boolean },
): boolean {
  return props.readerEditMode
    ? item.dividerBeforeEdit === true
    : item.dividerBeforeRead === true;
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
});
</script>

<template>
  <div ref="menuRootEl" class="convertMenuWrap">
    <IconButton
      :icon-html="convertSvg"
      :primary="readerEditMode"
      :active="menuOpen || (!readerEditMode && displayActive)"
      :pressed="menuOpen || (!readerEditMode && displayActive)"
      :title="buttonTitle"
      :aria-label="buttonTitle"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :disabled="disabled"
      @click.stop="toggleMenu"
    />
    <div
      v-if="menuOpen"
      class="convertMenuHost appShellMenuPanel"
      role="menu"
      @click.stop
    >
      <div
        class="appShellMenuSubWrap"
        @mouseenter="zhSubOpen = true"
        @mouseleave="zhSubOpen = false"
      >
        <button
          type="button"
          class="appShellMenuItem"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="zhSubOpen"
        >
          <span class="appShellMenuIconSlot" aria-hidden="true"></span>
          <span class="appShellMenuLabel">简 ↔ 繁</span>
          <span class="appShellMenuSubChevron">›</span>
        </button>
        <div
          v-show="zhSubOpen"
          class="appShellMenuFlyout appShellMenuFlyout--left convertMenuFlyout"
          role="menu"
          @click.stop
        >
          <template v-for="item in zhMenuItems" :key="item.id">
            <div
              v-if="showDividerBefore(item)"
              class="appShellMenuDivider convertMenuDivider"
              role="separator"
            ></div>
            <button
              type="button"
              class="appShellMenuFlyoutItem"
              :class="{ 'is-active': isZhItemActive(item.id) }"
              role="menuitem"
              @click="onSelectZh(item.id)"
            >
              <span class="appShellMenuFlyoutLabel">{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>

      <div
        class="appShellMenuSubWrap"
        @mouseenter="letterSubOpen = true"
        @mouseleave="letterSubOpen = false"
      >
        <button
          type="button"
          class="appShellMenuItem"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="letterSubOpen"
        >
          <span class="appShellMenuIconSlot" aria-hidden="true"></span>
          <span class="appShellMenuLabel">字母</span>
          <span class="appShellMenuSubChevron">›</span>
        </button>
        <div
          v-show="letterSubOpen"
          class="appShellMenuFlyout appShellMenuFlyout--left convertMenuFlyout"
          role="menu"
          @click.stop
        >
          <template v-for="item in letterMenuItems" :key="item.id">
            <div
              v-if="showDividerBefore(item)"
              class="appShellMenuDivider convertMenuDivider"
              role="separator"
            ></div>
            <button
              type="button"
              class="appShellMenuFlyoutItem"
              :class="{ 'is-active': isLetterItemActive(item.id) }"
              role="menuitem"
              @click="onSelectLetter(item.id)"
            >
              <span class="appShellMenuFlyoutLabel">{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>

      <div
        class="appShellMenuSubWrap"
        @mouseenter="digitSubOpen = true"
        @mouseleave="digitSubOpen = false"
      >
        <button
          type="button"
          class="appShellMenuItem"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="digitSubOpen"
        >
          <span class="appShellMenuIconSlot" aria-hidden="true"></span>
          <span class="appShellMenuLabel">数字</span>
          <span class="appShellMenuSubChevron">›</span>
        </button>
        <div
          v-show="digitSubOpen"
          class="appShellMenuFlyout appShellMenuFlyout--left convertMenuFlyout"
          role="menu"
          @click.stop
        >
          <template v-for="item in digitMenuItems" :key="item.id">
            <div
              v-if="showDividerBefore(item)"
              class="appShellMenuDivider convertMenuDivider"
              role="separator"
            ></div>
            <button
              type="button"
              class="appShellMenuFlyoutItem"
              :class="{ 'is-active': isDigitItemActive(item.id) }"
              role="menuitem"
              @click="onSelectDigit(item.id)"
            >
              <span class="appShellMenuFlyoutLabel">{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.convertMenuWrap {
  position: relative;
}

.convertMenuHost {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 5000;
  min-width: 168px;
}

.convertMenuHost::before,
.convertMenuHost::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.convertMenuHost::before {
  top: -8px;
  right: 6px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid var(--border);
}

.convertMenuHost::after {
  top: -7px;
  right: 7px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid var(--bg);
}

.convertMenuFlyout {
  min-width: 220px;
  /* 简 ↔ 繁 共 9 项，默认 320px 会裁切最后一项 */
  max-height: min(70vh, 420px);
  overflow-x: hidden;
  overflow-y: auto;
}

.convertMenuDivider {
  margin: 4px 0;
}
</style>
