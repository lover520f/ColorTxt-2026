/** 位于 `app.getPath("userData")` 下的默认角色立绘缓存子目录名 */
export const CHARACTER_PORTRAIT_DEFAULT_SUBDIR = "CharacterPortrait";

/** 侧栏立绘上传/拖放允许的常见图片后缀（不含点） */
export const PORTRAIT_UPLOAD_IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "svg",
] as const;

export function portraitImageExtensionFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function isPortraitUploadImagePath(path: string): boolean {
  const ext = portraitImageExtensionFromPath(path);
  return (
    ext !== "" &&
    (PORTRAIT_UPLOAD_IMAGE_EXTENSIONS as readonly string[]).includes(ext)
  );
}

/** 「选择图片」文件对话框过滤器 */
export const PORTRAIT_UPLOAD_OPEN_DIALOG_FILTERS: Array<{
  name: string;
  extensions: string[];
}> = [
  {
    name: "图片",
    extensions: [...PORTRAIT_UPLOAD_IMAGE_EXTENSIONS],
  },
];

const WIN_BAD = /[/\\?%*:|"<>]/g;

function joinPathSegments(...segments: string[]): string {
  const cleaned = segments
    .map((s) => s.replace(/[/\\]+$/, "").replace(/^[/\\]+/, "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return "";
  const sep = cleaned[0].includes("\\") ? "\\" : "/";
  return cleaned.join(sep);
}

export function defaultCharacterPortraitCacheRoot(userDataAbs: string): string {
  return joinPathSegments(userDataAbs, CHARACTER_PORTRAIT_DEFAULT_SUBDIR);
}

/** 用作磁盘一级目录名：去掉扩展名、替换非法字符、限长 */
export function sanitizeBookFolderSegment(filePathOrTitle: string, maxLen = 80): string {
  const normalized = filePathOrTitle.replace(/\\/g, "/").trim();
  const base =
    normalized.lastIndexOf("/") >= 0
      ? normalized.slice(normalized.lastIndexOf("/") + 1)
      : normalized;
  const dot = base.lastIndexOf(".");
  const withoutExt = dot > 0 ? base.slice(0, dot) : base;
  const s = withoutExt
    .trim()
    .replace(WIN_BAD, "_")
    .replace(/\s+/g, " ")
    .trim();
  const t = s || "book";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/** 角色名 → 立绘文件名（不含路径） */
export function portraitPngFileNameForCharacterName(displayName: string): string {
  const base = sanitizeBookFolderSegment(displayName.trim() || "character", 120);
  return `${base}.png`;
}

/** 角色名 → 临时立绘文件名（生成预览用，应用前不覆盖正式立绘） */
export function portraitTmpPngFileNameForCharacterName(displayName: string): string {
  const base = sanitizeBookFolderSegment(displayName.trim() || "character", 120);
  return `${base}_tmp.png`;
}

/**
 * 编辑抽屉内「待保存」立绘暂存文件名。
 * `sessionKey`：编辑已有角色时为角色 `id`；添加角色时为一次性 uuid。
 */
export function portraitSessionDraftPngFileName(sessionKey: string): string {
  const raw = sessionKey.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = raw.slice(0, 80) || "draft";
  return `_char_draft_${id}.png`;
}

export function characterPortraitTmpImageAbs(
  cacheRootAbs: string,
  bookFolderSegment: string,
  displayName: string,
): string {
  return joinPathSegments(
    cacheRootAbs.trim(),
    bookFolderSegment.trim(),
    portraitTmpPngFileNameForCharacterName(displayName),
  );
}

/** 编辑抽屉待保存立绘（选择图片 / AI 应用）的绝对路径 */
export function characterPortraitSessionDraftImageAbs(
  cacheRootAbs: string,
  bookFolderSegment: string,
  sessionKey: string,
): string {
  return joinPathSegments(
    cacheRootAbs.trim(),
    bookFolderSegment.trim(),
    portraitSessionDraftPngFileName(sessionKey),
  );
}

export function characterPortraitBookDirAbs(
  cacheRootAbs: string,
  bookFolderSegment: string,
): string {
  return joinPathSegments(cacheRootAbs.trim(), bookFolderSegment.trim());
}

export function characterPortraitImageAbs(
  cacheRootAbs: string,
  bookFolderSegment: string,
  displayName: string,
): string {
  return joinPathSegments(
    cacheRootAbs.trim(),
    bookFolderSegment.trim(),
    portraitPngFileNameForCharacterName(displayName),
  );
}
