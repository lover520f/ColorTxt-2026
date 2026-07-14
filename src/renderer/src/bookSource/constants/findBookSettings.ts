import type { TimedScrollSettings } from "../../constants/timedScroll";
import type {
  TextConvertWidthMode,
  TextConvertZhMode,
} from "@shared/textConvertTypes";

export const findBookSettingsKey = "colortxt.findBook.settings";

export const DEFAULT_FIND_BOOK_DOWNLOAD_CATEGORY = "下载";

export type FindBookDownloadAfterAction = "none" | "openMain" | "openNewWindow";

export const DEFAULT_FIND_BOOK_DOWNLOAD_AFTER_ACTION: FindBookDownloadAfterAction =
  "none";

/** 找书阅读器底部「上一章 / 下一章」工具栏（默认开启） */
export const defaultFindBookChapterNavToolbarEnabled = true;

export const FIND_BOOK_DOWNLOAD_AFTER_ACTION_OPTIONS = [
  { id: "none" as const, label: "无动作" },
  { id: "openMain" as const, label: "在主界面打开" },
  { id: "openNewWindow" as const, label: "在新窗口打开" },
];

export function isFindBookDownloadAfterAction(
  value: unknown,
): value is FindBookDownloadAfterAction {
  return (
    value === "none" || value === "openMain" || value === "openNewWindow"
  );
}

export function labelForFindBookDownloadAfterAction(
  action: FindBookDownloadAfterAction,
): string {
  return (
    FIND_BOOK_DOWNLOAD_AFTER_ACTION_OPTIONS.find((o) => o.id === action)?.label ??
    "无动作"
  );
}

/** 找书窗口独立持久化的设置（主题色、语音朗读仍走主应用设置） */
export type PersistedFindBookSettings = {
  /** 章节正文离线缓存根目录 */
  cacheDir?: string;
  downloadDir?: string;
  downloadAfterAction?: FindBookDownloadAfterAction;
  downloadAddToMainFileList?: boolean;
  downloadDefaultCategory?: string;
  fontSize?: number;
  lineHeightMultiple?: number;
  fontFamily?: string;
  pinnedOtherFonts?: string[];
  monacoCustomHighlight?: boolean;
  txtrDelimitedMatchCrossLine?: boolean;
  compressBlankLines?: boolean;
  compressBlankKeepOneBlank?: boolean;
  leadIndentFullWidth?: boolean;
  textConvertZh?: TextConvertZhMode;
  textConvertLetter?: TextConvertWidthMode;
  textConvertDigit?: TextConvertWidthMode;
  monacoAdvancedWrapping?: boolean;
  monacoSmoothScrolling?: boolean;
  stickyChapterTitleEnabled?: boolean;
  chapterNavToolbarEnabled?: boolean;
  fullscreenReaderWidthPercent?: number;
  sidebarWidth?: number;
  timedScroll?: Partial<TimedScrollSettings>;
};
