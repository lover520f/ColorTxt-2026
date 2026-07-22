import type { HighlightWordsByIndex } from "../stores/fileMetaStore";
import { normalizeHighlightWordsByIndex } from "../stores/fileMetaStore";
import { mergeHighlightWordsByIndex } from "./highlightWords";
import {
  bookTitleForExport,
  pickAndReadJsonFile,
  saveAnnotationExportFile,
} from "./readerAnnotationExport";
import {
  chatExportDateSlug,
  sanitizeChatExportTitleForFilename,
} from "../aiAssistant/aiAssistantExport";

/** 本书 / 收藏共用同一 JSON 形态，可互导入 */
export type ReaderHighlightsExportV1 = {
  schemaVersion: 1;
  exportedAt: number;
  highlightWordsByIndex: HighlightWordsByIndex;
};

export function buildHighlightExportDefaultName(bookName: string): string {
  const slug = chatExportDateSlug();
  const titlePart = sanitizeChatExportTitleForFilename(
    bookTitleForExport(bookName || "高亮词"),
  );
  return `highlights-${slug}-${titlePart}.json`;
}

export function buildFavoriteHighlightExportDefaultName(): string {
  return `highlights-favorites-${chatExportDateSlug()}.json`;
}

export function countHighlightWordsInMap(
  map: HighlightWordsByIndex | undefined,
): number {
  if (!map) return 0;
  let n = 0;
  for (const words of Object.values(map)) {
    n += words.length;
  }
  return n;
}

export function buildReaderHighlightsExportJson(
  highlightWordsByIndex: HighlightWordsByIndex,
): string {
  const payload: ReaderHighlightsExportV1 = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    highlightWordsByIndex,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseReaderHighlightsExportJson(
  raw: string,
): ReaderHighlightsExportV1 | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      (parsed as ReaderHighlightsExportV1).schemaVersion !== 1
    ) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const highlightWordsByIndex = normalizeHighlightWordsByIndex(
      obj.highlightWordsByIndex,
    );
    if (!highlightWordsByIndex) return null;
    return {
      schemaVersion: 1,
      exportedAt:
        typeof obj.exportedAt === "number" && Number.isFinite(obj.exportedAt)
          ? obj.exportedAt
          : Date.now(),
      highlightWordsByIndex,
    };
  } catch {
    return null;
  }
}

/** 合并导入词表：同词以导入侧颜色为准 */
export function mergeImportedHighlightWords(
  local: HighlightWordsByIndex | undefined,
  imported: HighlightWordsByIndex,
): HighlightWordsByIndex {
  return mergeHighlightWordsByIndex(local, imported) ?? imported;
}

export async function saveHighlightExportFile(
  defaultName: string,
  data: string,
): Promise<
  | { ok: true; path: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }
> {
  return saveAnnotationExportFile(defaultName, data, "json");
}

export async function pickAndReadHighlightJsonFile(
  title: string,
): Promise<
  | { ok: true; text: string; path: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }
> {
  return pickAndReadJsonFile(title);
}
