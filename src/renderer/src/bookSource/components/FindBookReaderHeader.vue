<script setup lang="ts">
import { computed, ref } from "vue";
import IconButton from "../../components/IconButton.vue";
import HeaderFontToolbar from "../../components/HeaderFontToolbar.vue";
import HeaderFormatToolbar from "../../components/HeaderFormatToolbar.vue";
import AppShellMenuTeleport from "../../components/AppShellMenuTeleport.vue";
import { useAppHeaderLayout } from "../../composables/useAppHeaderLayout";
import { useAnchoredAppShellMenu } from "../../composables/useAnchoredAppShellMenu";
import {
  FIND_BOOK_READER_COMPACT_FONT_BREAKPOINT,
  FIND_BOOK_READER_COMPACT_FORMAT_BREAKPOINT,
} from "../../constants/appHeaderLayout";
import { icons } from "../../icons";
import type {
  TextConvertWidthMode,
  TextConvertZhMode,
} from "@shared/textConvertTypes";

const props = withDefaults(
  defineProps<{
    currentTheme: string;
    showSidebar: boolean;
    inFullscreen?: boolean;
    canIncreaseFont: boolean;
    canDecreaseFont: boolean;
    canIncreaseLineHeight: boolean;
    canDecreaseLineHeight: boolean;
    monacoFontFamily: string;
    pinnedOtherFonts?: string[];
    monacoAdvancedWrapping: boolean;
    monacoCustomHighlight: boolean;
    compressBlankLines: boolean;
    leadIndentFullWidth: boolean;
    textConvertZh?: TextConvertZhMode;
    textConvertLetter?: TextConvertWidthMode;
    textConvertDigit?: TextConvertWidthMode;
    voiceReadActive?: boolean;
    canVoiceRead?: boolean;
    timedScrollActive?: boolean;
    canTimedScroll?: boolean;
    voiceReadHeaderLocked?: boolean;
    inBookshelf?: boolean;
    /** 设置菜单项右侧快捷键文案（如 F5） */
    settingsShortcutLabel?: string;
  }>(),
  {
    inFullscreen: false,
    pinnedOtherFonts: () => [],
    textConvertZh: "off",
    textConvertLetter: "off",
    textConvertDigit: "off",
    voiceReadActive: false,
    canVoiceRead: true,
    timedScrollActive: false,
    canTimedScroll: true,
    voiceReadHeaderLocked: false,
    inBookshelf: false,
    settingsShortcutLabel: "",
  },
);

const emit = defineEmits<{
  changeTheme: [theme: string];
  toggleSidebar: [];
  toggleFullscreen: [];
  setMonacoFont: [fontFamily: string];
  togglePinOtherFont: [fontName: string];
  increaseFontSize: [];
  decreaseFontSize: [];
  increaseLineHeight: [];
  decreaseLineHeight: [];
  toggleCompressBlankLines: [];
  toggleLeadIndentFullWidth: [];
  selectTextConvertZhRead: [mode: TextConvertZhMode];
  selectTextConvertLetterRead: [mode: TextConvertWidthMode];
  selectTextConvertDigitRead: [mode: TextConvertWidthMode];
  toggleMonacoAdvancedWrapping: [];
  toggleMonacoCustomHighlight: [];
  voiceReadToggle: [];
  timedScrollToggle: [];
  openSettings: [];
  toggleBookshelf: [];
}>();

const vrFormatLock = computed(() => props.voiceReadHeaderLocked);
const { compactFontToolbar, compactFormatToolbar } = useAppHeaderLayout({
  compactFontBreakpoint: FIND_BOOK_READER_COMPACT_FONT_BREAKPOINT,
  compactFormatBreakpoint: FIND_BOOK_READER_COMPACT_FORMAT_BREAKPOINT,
});
const showFontToolbarInHeader = computed(() => !compactFontToolbar.value);
const showFormatToolbarInHeader = computed(() => !compactFormatToolbar.value);
const showToolbarInMoreMenu = computed(
  () => compactFontToolbar.value || compactFormatToolbar.value,
);
const bookshelfBtnLabel = computed(() =>
  props.inBookshelf ? "从书架移除" : "放入书架",
);

const moreBtnRef = ref<HTMLElement | null>(null);
const moreMenu = useAnchoredAppShellMenu({
  anchor: moreBtnRef,
  placement: "below-end",
  widthPx: 320,
});
const {
  open: moreMenuOpen,
  left: moreMenuLeft,
  top: moreMenuTop,
  toggleMenu: toggleMoreMenu,
  closeMenu: closeMoreMenu,
  panelRef: moreMenuPanelRef,
} = moreMenu;

function bindMoreMenuPanel(el: HTMLElement | null) {
  moreMenuPanelRef.value = el;
}

function onOpenSettingsFromToolbar() {
  closeMoreMenu();
  emit("openSettings");
}
</script>

<template>
  <header class="findBookReaderHeader">
    <button
      type="button"
      class="btn findBookReaderBookshelfBtn"
      size="large"
      :class="{ 'findBookReaderBookshelfBtn--remove': inBookshelf }"
      :aria-label="bookshelfBtnLabel"
      @click="emit('toggleBookshelf')"
    >
      <span
        class="findBookReaderBookshelfBtnIcon"
        aria-hidden="true"
        v-html="icons.bookshelf"
      />
      {{ bookshelfBtnLabel }}
    </button>
    <div class="themePicker">
      <div class="headerQuickRow">
        <IconButton
          class="timedScrollBtn"
          :icon-html="icons.play"
          :active="timedScrollActive"
          :pressed="timedScrollActive"
          title="定时滚动"
          aria-label="定时滚动"
          :disabled="!timedScrollActive && !canTimedScroll"
          @click="emit('timedScrollToggle')"
        />
        <IconButton
          class="voiceReadBtn"
          :icon-html="icons.reading"
          :active="voiceReadActive"
          :pressed="voiceReadActive"
          title="语音朗读"
          aria-label="语音朗读"
          :disabled="!voiceReadActive && (!canVoiceRead || timedScrollActive)"
          @click="emit('voiceReadToggle')"
        />
        <span
          v-if="showFontToolbarInHeader || showFormatToolbarInHeader"
          class="toolbarDivider"
          aria-hidden="true"
        />
        <HeaderFontToolbar
          v-if="showFontToolbarInHeader"
          class="hdrLockable"
          :monaco-font-family="monacoFontFamily"
          :pinned-other-fonts="pinnedOtherFonts"
          :disabled="vrFormatLock"
          :can-increase-font="canIncreaseFont"
          :can-decrease-font="canDecreaseFont"
          :can-increase-line-height="canIncreaseLineHeight"
          :can-decrease-line-height="canDecreaseLineHeight"
          @set-monaco-font="(fontFamily) => emit('setMonacoFont', fontFamily)"
          @toggle-pin-other-font="(fontName) => emit('togglePinOtherFont', fontName)"
          @increase-font-size="emit('increaseFontSize')"
          @decrease-font-size="emit('decreaseFontSize')"
          @increase-line-height="emit('increaseLineHeight')"
          @decrease-line-height="emit('decreaseLineHeight')"
        />
        <span
          v-if="showFontToolbarInHeader && showFormatToolbarInHeader"
          class="toolbarDivider"
          aria-hidden="true"
        />
        <HeaderFormatToolbar
          v-if="showFormatToolbarInHeader"
          class="hdrLockable"
          :reader-edit-mode="false"
          :disabled="vrFormatLock"
          :text-convert-zh="textConvertZh"
          :text-convert-letter="textConvertLetter"
          :text-convert-digit="textConvertDigit"
          :compress-blank-lines="compressBlankLines"
          :lead-indent-full-width="leadIndentFullWidth"
          :monaco-advanced-wrapping="monacoAdvancedWrapping"
          :monaco-custom-highlight="monacoCustomHighlight"
          @select-text-convert-zh-read="emit('selectTextConvertZhRead', $event)"
          @select-text-convert-letter-read="emit('selectTextConvertLetterRead', $event)"
          @select-text-convert-digit-read="emit('selectTextConvertDigitRead', $event)"
          @toggle-compress-blank-lines="emit('toggleCompressBlankLines')"
          @toggle-lead-indent-full-width="emit('toggleLeadIndentFullWidth')"
          @toggle-monaco-advanced-wrapping="emit('toggleMonacoAdvancedWrapping')"
          @toggle-monaco-custom-highlight="emit('toggleMonacoCustomHighlight')"
        />
        <span class="toolbarDivider" aria-hidden="true" />
        <IconButton
          :icon-html="currentTheme === 'vs' ? icons.light : icons.dark"
          :title="currentTheme === 'vs' ? '当前亮色，点击切换暗色' : '当前暗色，点击切换亮色'"
          @click="emit('changeTheme', currentTheme === 'vs' ? 'vs-dark' : 'vs')"
        />
        <IconButton
          v-if="!inFullscreen"
          :icon-html="icons.sidebar"
          :active="showSidebar"
          :pressed="showSidebar"
          title="切换侧边栏"
          @click="emit('toggleSidebar')"
        />
        <IconButton
          :icon-html="inFullscreen ? icons.leaveFullscreen : icons.enterFullscreen"
          :title="inFullscreen ? '退出全屏' : '全屏阅读'"
          @click="emit('toggleFullscreen')"
        />
        <div ref="moreBtnRef" class="findBookReaderMoreWrap">
          <IconButton
            :icon-html="icons.more"
            :active="moreMenuOpen"
            :pressed="moreMenuOpen"
            title="更多"
            aria-label="更多"
            aria-haspopup="menu"
            :aria-expanded="moreMenuOpen"
            @click="toggleMoreMenu"
          />
        </div>
      </div>
    </div>
    <AppShellMenuTeleport
      v-model:open="moreMenuOpen"
      :min-width="120"
      :left="moreMenuLeft"
      :top="moreMenuTop"
      :fullscreen-header-float="inFullscreen"
      :on-panel-mount="bindMoreMenuPanel"
    >
      <div v-if="showToolbarInMoreMenu" class="findBookReaderMorePanel">
        <HeaderFontToolbar
          v-if="compactFontToolbar"
          :monaco-font-family="monacoFontFamily"
          :pinned-other-fonts="pinnedOtherFonts"
          :disabled="vrFormatLock"
          :can-increase-font="canIncreaseFont"
          :can-decrease-font="canDecreaseFont"
          :can-increase-line-height="canIncreaseLineHeight"
          :can-decrease-line-height="canDecreaseLineHeight"
          @set-monaco-font="(fontFamily) => { emit('setMonacoFont', fontFamily); closeMoreMenu(); }"
          @toggle-pin-other-font="(fontName) => emit('togglePinOtherFont', fontName)"
          @increase-font-size="emit('increaseFontSize')"
          @decrease-font-size="emit('decreaseFontSize')"
          @increase-line-height="emit('increaseLineHeight')"
          @decrease-line-height="emit('decreaseLineHeight')"
        />
        <HeaderFormatToolbar
          v-if="compactFormatToolbar"
          :reader-edit-mode="false"
          :disabled="vrFormatLock"
          :text-convert-zh="textConvertZh"
          :text-convert-letter="textConvertLetter"
          :text-convert-digit="textConvertDigit"
          :compress-blank-lines="compressBlankLines"
          :lead-indent-full-width="leadIndentFullWidth"
          :monaco-advanced-wrapping="monacoAdvancedWrapping"
          :monaco-custom-highlight="monacoCustomHighlight"
          @select-text-convert-zh-read="emit('selectTextConvertZhRead', $event)"
          @select-text-convert-letter-read="emit('selectTextConvertLetterRead', $event)"
          @select-text-convert-digit-read="emit('selectTextConvertDigitRead', $event)"
          @toggle-compress-blank-lines="emit('toggleCompressBlankLines')"
          @toggle-lead-indent-full-width="emit('toggleLeadIndentFullWidth')"
          @toggle-monaco-advanced-wrapping="emit('toggleMonacoAdvancedWrapping')"
          @toggle-monaco-custom-highlight="emit('toggleMonacoCustomHighlight')"
        />
      </div>
      <div
        v-if="showToolbarInMoreMenu"
        class="appShellMenuDivider"
        role="separator"
      />
      <button
        type="button"
        class="appShellMenuItem"
        role="menuitem"
        @click="onOpenSettingsFromToolbar"
      >
        <span class="appShellMenuIconSlot" v-html="icons.setting" />
        <span class="appShellMenuLabel">设置</span>
        <span v-if="settingsShortcutLabel" class="appShellMenuShortcut">{{
          settingsShortcutLabel
        }}</span>
      </button>
    </AppShellMenuTeleport>
  </header>
</template>

<style scoped>
.findBookReaderHeader {
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  min-height: 0;
  overflow: visible;
}
.findBookReaderBookshelfBtnIcon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.findBookReaderBookshelfBtnIcon :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}
.findBookReaderBookshelfBtnIcon :deep(svg path) {
  fill: currentColor;
}
.findBookReaderBookshelfBtn--remove:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-bg);
}
.themePicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}
.headerQuickRow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.toolbarDivider {
  width: 1px;
  height: 22px;
  background: var(--border);
  flex-shrink: 0;
}
.findBookReaderMoreWrap {
  display: inline-flex;
}
.findBookReaderMorePanel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}
.hdrLockable {
  display: inline-flex;
  align-items: center;
}
</style>
