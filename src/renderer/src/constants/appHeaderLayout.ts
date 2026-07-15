/** 窗口宽度低于此值时，字体/字号/行高组收入「更多」菜单 */
export const HEADER_COMPACT_FONT_BREAKPOINT = 1070;
/** 窗口宽度低于此值时，转换/格式组也收入「更多」菜单 */
export const HEADER_COMPACT_FORMAT_BREAKPOINT = 870;

/** 找书在线阅读器工具栏按钮较少，收纳断点可更小 */
export const FIND_BOOK_READER_COMPACT_FONT_BREAKPOINT = 895;
export const FIND_BOOK_READER_COMPACT_FORMAT_BREAKPOINT = 695;

export type AppHeaderLayoutOptions = {
  /** 低于此窗口宽度时，字体组收入「更多」；默认 {@link HEADER_COMPACT_FONT_BREAKPOINT} */
  compactFontBreakpoint?: number;
  /** 低于此窗口宽度时，格式组也收入「更多」；默认 {@link HEADER_COMPACT_FORMAT_BREAKPOINT} */
  compactFormatBreakpoint?: number;
};
