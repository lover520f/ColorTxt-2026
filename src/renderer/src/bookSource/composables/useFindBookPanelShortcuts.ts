import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import {
  persistKey,
  persistedSettingsChangedEvent,
} from "../../constants/appUi";
import { loadPersistedSettingsData } from "../../stores/cacheStore";
import {
  createDefaultShortcutBindings,
  type ShortcutBindingMap,
} from "../../services/shortcutRegistry";
import {
  bindAppShortcuts,
  type AppShortcutActions,
} from "../../services/shortcutService";
import { mergeShortcutBindings } from "../../services/shortcutUtils";
import { hasEscBeforeModalLayers } from "../../utils/modalStack";
import { appAlert } from "../../services/appDialog";
import type { FindBookSettingsTabId } from "../components/FindBookSettingsTabBar.vue";

const defaultShortcutBindings = createDefaultShortcutBindings(
  /mac|iphone|ipad|ipod/i.test(navigator.platform || ""),
);

/** 阅读器打开时仍由找书面板处理的快捷键（其余交给 useFindBookReaderShortcuts） */
const PANEL_ACTIONS_WHEN_READER_OPEN = new Set<keyof AppShortcutActions>([
  "openSettings",
  "openBookSource",
]);

function loadMainShortcutBindings():
  | Partial<ShortcutBindingMap>
  | undefined {
  return loadPersistedSettingsData(localStorage, persistKey)?.data
    ?.shortcutBindings;
}

/** 找书窗口：设置 / 书源管理快捷键在找书面板内始终可用（与主界面同一套绑定） */
export function useFindBookPanelShortcuts(deps: {
  showSettingsPanel: Ref<boolean>;
  showBookSourcePanel: Ref<boolean>;
  showBookReader: Ref<boolean>;
  openSettings: (tab?: FindBookSettingsTabId) => void;
  openBookSources: () => void;
}) {
  const shortcutBindings = ref<ShortcutBindingMap>(
    mergeShortcutBindings(defaultShortcutBindings, loadMainShortcutBindings()),
  );

  let unbindShortcuts: (() => void) | null = null;

  /** 把「隐藏/显示阅读器」等系统级全局快捷键同步到主进程（找书独立启动时主窗口不会挂载） */
  async function applyGlobalShortcutFromBindings() {
    const accel = shortcutBindings.value.toggleAllWindowsVisibility?.trim();
    if (!accel || !window.colorTxt?.setGlobalShortcut) return;
    const r = await window.colorTxt.setGlobalShortcut(accel);
    if (!r.ok) {
      await appAlert(r.message || "系统级快捷键设置失败");
    }
  }

  function syncShortcutBindingsFromMain() {
    shortcutBindings.value = mergeShortcutBindings(
      defaultShortcutBindings,
      loadMainShortcutBindings(),
    );
    void applyGlobalShortcutFromBindings();
  }

  function bindShortcuts() {
    if (unbindShortcuts) return;
    unbindShortcuts = bindAppShortcuts(
      {
        openSettings: () => {
          deps.openSettings(deps.showBookReader.value ? "reading" : "download");
        },
        openBookSource: () => {
          deps.openBookSources();
        },
        openColorScheme: () => {},
        openFindBook: () => {},
        toggleFullscreen: () => {},
        increaseFontSize: () => {},
        decreaseFontSize: () => {},
        increaseLineHeight: () => {},
        decreaseLineHeight: () => {},
        toggleSidebar: () => {},
        openNewWindow: () => {},
        openFile: () => {},
        pickTxtDirectory: () => {},
        openChapterRules: () => {},
        toggleBookmark: () => {},
        jumpToPrevChapter: () => {},
        jumpToNextChapter: () => {},
        toggleFind: () => {},
        scrollDownLine: () => {},
        scrollUpLine: () => {},
        scrollPageUp: () => {},
        scrollPageDown: () => {},
      },
      () => shortcutBindings.value,
      () =>
        !deps.showSettingsPanel.value &&
        !deps.showBookSourcePanel.value &&
        !hasEscBeforeModalLayers(),
      (action) =>
        deps.showBookReader.value &&
        !PANEL_ACTIONS_WHEN_READER_OPEN.has(action),
    );
  }

  function onStorageSync(ev: StorageEvent) {
    if (ev.storageArea !== localStorage || ev.key !== persistKey) return;
    syncShortcutBindingsFromMain();
  }

  onMounted(() => {
    syncShortcutBindingsFromMain();
    bindShortcuts();
    window.addEventListener("storage", onStorageSync);
    window.addEventListener(
      persistedSettingsChangedEvent,
      syncShortcutBindingsFromMain,
    );
  });

  onBeforeUnmount(() => {
    unbindShortcuts?.();
    unbindShortcuts = null;
    window.removeEventListener("storage", onStorageSync);
    window.removeEventListener(
      persistedSettingsChangedEvent,
      syncShortcutBindingsFromMain,
    );
  });

  return { shortcutBindings };
}
