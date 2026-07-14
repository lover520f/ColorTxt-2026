import { computed, ref } from "vue";
import {
  createInitialFindBookSettingsState,
  persistFindBookSettings,
  snapshotFindBookSettingsFromStore,
} from "../services/findBookSettingsStore";
import {
  resolveDefaultBookSourceChapterCacheDirSync,
  resolveDefaultBookSourceDownloadDirSync,
} from "../../utils/defaultCacheDirs";

let store: ReturnType<typeof createFindBookSettingsStore> | null = null;

function createFindBookSettingsStore() {
  const initial = createInitialFindBookSettingsState();

  const cacheDir = ref(initial.cacheDir);
  const downloadDir = ref(initial.downloadDir);
  const downloadAfterAction = ref(initial.downloadAfterAction);
  const downloadAddToMainFileList = ref(initial.downloadAddToMainFileList);
  const downloadDefaultCategory = ref(initial.downloadDefaultCategory);
  const readerFontSize = ref(initial.readerFontSize);
  const readerLineHeightMultiple = ref(initial.readerLineHeightMultiple);
  const monacoFontFamily = ref(initial.monacoFontFamily);
  const pinnedOtherFonts = ref(initial.pinnedOtherFonts);
  const monacoCustomHighlight = ref(initial.monacoCustomHighlight);
  const txtrDelimitedMatchCrossLine = ref(initial.txtrDelimitedMatchCrossLine);
  const compressBlankLines = ref(initial.compressBlankLines);
  const compressBlankKeepOneBlank = ref(initial.compressBlankKeepOneBlank);
  const leadIndentFullWidth = ref(initial.leadIndentFullWidth);
  const textConvertZh = ref(initial.textConvertZh);
  const textConvertLetter = ref(initial.textConvertLetter);
  const textConvertDigit = ref(initial.textConvertDigit);
  const monacoAdvancedWrapping = ref(initial.monacoAdvancedWrapping);
  const monacoSmoothScrolling = ref(initial.monacoSmoothScrolling);
  const stickyChapterTitleEnabled = ref(initial.stickyChapterTitleEnabled);
  const chapterNavToolbarEnabled = ref(initial.chapterNavToolbarEnabled);
  const fullscreenReaderWidthPercent = ref(initial.fullscreenReaderWidthPercent);
  const sidebarWidth = ref(initial.sidebarWidth);
  const timedScrollSettings = ref(initial.timedScrollSettings);

  const effectiveCacheDir = computed(() => {
    const configured = cacheDir.value.trim();
    return configured || resolveDefaultBookSourceChapterCacheDirSync();
  });

  const effectiveDownloadDir = computed(() => {
    const configured = downloadDir.value.trim();
    return configured || resolveDefaultBookSourceDownloadDirSync();
  });

  function persistAll() {
    persistFindBookSettings(
      snapshotFindBookSettingsFromStore({
        cacheDir: cacheDir.value,
        downloadDir: downloadDir.value,
        downloadAfterAction: downloadAfterAction.value,
        downloadAddToMainFileList: downloadAddToMainFileList.value,
        downloadDefaultCategory: downloadDefaultCategory.value,
        readerFontSize: readerFontSize.value,
        readerLineHeightMultiple: readerLineHeightMultiple.value,
        monacoFontFamily: monacoFontFamily.value,
        pinnedOtherFonts: pinnedOtherFonts.value,
        monacoCustomHighlight: monacoCustomHighlight.value,
        txtrDelimitedMatchCrossLine: txtrDelimitedMatchCrossLine.value,
        compressBlankLines: compressBlankLines.value,
        compressBlankKeepOneBlank: compressBlankKeepOneBlank.value,
        leadIndentFullWidth: leadIndentFullWidth.value,
        textConvertZh: textConvertZh.value,
        textConvertLetter: textConvertLetter.value,
        textConvertDigit: textConvertDigit.value,
        monacoAdvancedWrapping: monacoAdvancedWrapping.value,
        monacoSmoothScrolling: monacoSmoothScrolling.value,
        stickyChapterTitleEnabled: stickyChapterTitleEnabled.value,
        chapterNavToolbarEnabled: chapterNavToolbarEnabled.value,
        fullscreenReaderWidthPercent: fullscreenReaderWidthPercent.value,
        sidebarWidth: sidebarWidth.value,
        timedScrollSettings: timedScrollSettings.value,
      }),
    );
  }

  function persistReaderUiPrefs() {
    persistAll();
  }

  return {
    cacheDir,
    downloadDir,
    downloadAfterAction,
    downloadAddToMainFileList,
    downloadDefaultCategory,
    effectiveCacheDir,
    effectiveDownloadDir,
    readerFontSize,
    readerLineHeightMultiple,
    monacoFontFamily,
    pinnedOtherFonts,
    monacoCustomHighlight,
    txtrDelimitedMatchCrossLine,
    compressBlankLines,
    compressBlankKeepOneBlank,
    leadIndentFullWidth,
    textConvertZh,
    textConvertLetter,
    textConvertDigit,
    monacoAdvancedWrapping,
    monacoSmoothScrolling,
    stickyChapterTitleEnabled,
    chapterNavToolbarEnabled,
    fullscreenReaderWidthPercent,
    sidebarWidth,
    timedScrollSettings,
    persistAll,
    persistReaderUiPrefs,
  };
}

export function useFindBookSettings() {
  if (!store) store = createFindBookSettingsStore();
  return store;
}

export function resetFindBookSettingsStoreForTests() {
  store = null;
}
