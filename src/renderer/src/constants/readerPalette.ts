/**
 * 阅读器表面色（背景、章节标题、正文、Monaco txtr.* token）。
 * 默认值与历史 readerInlineDecorations / style.css 一致；用户自定义通过 Partial 合并。
 */
export type ReaderSurfacePalette = {
  readerBg: string;
  chapterTitle: string;
  /** 无 txtr token 时的正文（Monaco `editor.foreground`） */
  bodyText: string;
  txtrQuoteInner: string;
  txtrBracketInner: string;
  txtrPunctuation: string;
  txtrSpecialMarker: string;
  txtrNumber: string;
  txtrEnglish: string;
};

export const READER_SURFACE_KEYS = [
  "readerBg",
  "chapterTitle",
  "bodyText",
  "txtrQuoteInner",
  "txtrBracketInner",
  "txtrPunctuation",
  "txtrSpecialMarker",
  "txtrNumber",
  "txtrEnglish",
] as const satisfies readonly (keyof ReaderSurfacePalette)[];

/** 可单独开关的 token 配色（关闭时回退为正文色） */
export const READER_SURFACE_OPTIONAL_COLOR_KEYS = [
  "txtrQuoteInner",
  "txtrBracketInner",
  "txtrPunctuation",
  "txtrSpecialMarker",
  "txtrNumber",
  "txtrEnglish",
] as const satisfies readonly (keyof ReaderSurfacePalette)[];

export type ReaderSurfaceOptionalColorKey =
  (typeof READER_SURFACE_OPTIONAL_COLOR_KEYS)[number];

export type ReaderSurfaceColorEnabled = Record<
  ReaderSurfaceOptionalColorKey,
  boolean
>;

export const defaultReaderPaletteColorEnabled: ReaderSurfaceColorEnabled = {
  txtrQuoteInner: true,
  txtrBracketInner: true,
  txtrPunctuation: true,
  txtrSpecialMarker: true,
  txtrNumber: true,
  txtrEnglish: true,
};

export function isReaderSurfaceOptionalColorKey(
  key: keyof ReaderSurfacePalette,
): key is ReaderSurfaceOptionalColorKey {
  return (READER_SURFACE_OPTIONAL_COLOR_KEYS as readonly string[]).includes(key);
}

/** 配色表一行：双列；「背景色」单独一行 */
export type ReaderSurfaceTableRow =
  | readonly [keyof ReaderSurfacePalette, keyof ReaderSurfacePalette]
  | readonly [keyof ReaderSurfacePalette];

export const READER_SURFACE_TABLE_ROWS: readonly ReaderSurfaceTableRow[] = [
  ["readerBg"],
  ["chapterTitle", "bodyText"],
  ["txtrQuoteInner", "txtrBracketInner"],
  ["txtrPunctuation", "txtrSpecialMarker"],
  ["txtrNumber", "txtrEnglish"],
];

export const READER_SURFACE_LABELS: Record<keyof ReaderSurfacePalette, string> =
  {
    readerBg: "背景色",
    chapterTitle: "章节标题",
    bodyText: "正文",
    txtrQuoteInner: "引号内文字",
    txtrBracketInner: "括号内文字",
    txtrPunctuation: "标点",
    txtrSpecialMarker: "特殊标记",
    txtrNumber: "数字",
    txtrEnglish: "字母",
  };

export const defaultReaderPaletteLight: ReaderSurfacePalette = {
  readerBg: "#f4ead7",
  chapterTitle: "#b88230",
  bodyText: "#000000",
  txtrQuoteInner: "#a31515",
  txtrBracketInner: "#001080",
  txtrPunctuation: "#267f99",
  txtrSpecialMarker: "#f56c6c",
  txtrNumber: "#795e26",
  txtrEnglish: "#af00db",
};

export const defaultReaderPaletteDark: ReaderSurfacePalette = {
  readerBg: "#1e1e1e",
  chapterTitle: "#569cd6",
  bodyText: "#d4d4d4",
  txtrQuoteInner: "#ce9178",
  txtrBracketInner: "#9cdcfe",
  txtrPunctuation: "#4ec9b0",
  txtrSpecialMarker: "#f56c6c",
  txtrNumber: "#dcdcaa",
  txtrEnglish: "#c586c0",
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function isValidReaderSurfaceHex(s: string): boolean {
  return typeof s === "string" && HEX6.test(s);
}

/** 从持久化 JSON 解析用户覆盖片段，非法键或色值丢弃 */
export function parseReaderPaletteOverrides(
  raw: unknown,
): Partial<ReaderSurfacePalette> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<ReaderSurfacePalette> = {};
  for (const key of READER_SURFACE_KEYS) {
    const v = o[key];
    if (typeof v === "string" && isValidReaderSurfaceHex(v)) {
      (out as Record<string, string>)[key] = v;
    }
  }
  return out;
}

export function mergeReaderSurfacePalette(
  base: ReaderSurfacePalette,
  partial?: Partial<ReaderSurfacePalette> | null,
): ReaderSurfacePalette {
  if (!partial) return { ...base };
  return { ...base, ...partial };
}

/** 与默认比较，得到应持久化的覆盖片段（与默认相同则不写入） */
export function overridesFromFullPalette(
  draft: ReaderSurfacePalette,
  defaults: ReaderSurfacePalette,
): Partial<ReaderSurfacePalette> {
  const out: Partial<ReaderSurfacePalette> = {};
  for (const key of READER_SURFACE_KEYS) {
    if (draft[key].toLowerCase() !== defaults[key].toLowerCase()) {
      (out as Record<string, string>)[key] = draft[key];
    }
  }
  return out;
}

export function mergeReaderPaletteColorEnabled(
  partial?: Partial<ReaderSurfaceColorEnabled> | null,
): ReaderSurfaceColorEnabled {
  if (!partial) return { ...defaultReaderPaletteColorEnabled };
  return { ...defaultReaderPaletteColorEnabled, ...partial };
}

/** 从持久化 JSON 解析开关覆盖；仅接受 `false`（默认全开） */
export function parseReaderPaletteColorEnabledOverrides(
  raw: unknown,
): Partial<ReaderSurfaceColorEnabled> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<ReaderSurfaceColorEnabled> = {};
  for (const key of READER_SURFACE_OPTIONAL_COLOR_KEYS) {
    if (o[key] === false) {
      out[key] = false;
    }
  }
  return out;
}

/** 与默认比较，得到应持久化的开关覆盖（仅 `false` 写入） */
export function overridesFromColorEnabled(
  draft: ReaderSurfaceColorEnabled,
  defaults: ReaderSurfaceColorEnabled = defaultReaderPaletteColorEnabled,
): Partial<ReaderSurfaceColorEnabled> {
  const out: Partial<ReaderSurfaceColorEnabled> = {};
  for (const key of READER_SURFACE_OPTIONAL_COLOR_KEYS) {
    if (draft[key] !== defaults[key]) {
      out[key] = draft[key];
    }
  }
  return out;
}

/** 将关闭的 token 色回退为正文色，供 Monaco 主题与预览使用 */
export function resolveEffectiveReaderPalette(
  palette: ReaderSurfacePalette,
  enabled: ReaderSurfaceColorEnabled,
): ReaderSurfacePalette {
  const out = { ...palette };
  for (const key of READER_SURFACE_OPTIONAL_COLOR_KEYS) {
    if (!enabled[key]) {
      out[key] = palette.bodyText;
    }
  }
  return out;
}

/**
 * 将当前 App 主题对应的阅读器变量写入 `document.documentElement`，供 `var(--reader-bg)` 等使用。
 * 仅处理 `vs` / `vs-dark`。
 */
export function applyReaderSurfaceToDocument(
  theme: string,
  lightPalette: ReaderSurfacePalette = defaultReaderPaletteLight,
  darkPalette: ReaderSurfacePalette = defaultReaderPaletteDark,
): void {
  if (theme !== "vs" && theme !== "vs-dark") return;
  const p = theme === "vs" ? lightPalette : darkPalette;
  const root = document.documentElement;
  root.style.setProperty("--reader-bg", p.readerBg);
  root.style.setProperty("--reader-body-text", p.bodyText);
  root.style.setProperty("--reader-chapter-title", p.chapterTitle);
}
