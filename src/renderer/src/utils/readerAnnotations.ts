import * as monaco from "monaco-editor";
import type { Chapter } from "../chapter";
import { parseLineationColorIndexRaw } from "../constants/annotationColors";
import { pickActiveChapterIdx } from "../reader/chapterIndex";
import type {
  ReaderAnnotationRecord,
  ReaderLineationType,
} from "../stores/fileMetaStore";

export type AnnotationListRow = {
  id: string;
  kind: "lineation" | "note";
  text: string;
  lineationType?: ReaderLineationType;
  colorIndex?: number;
  noteContent?: string;
  stale?: boolean;
  createdAt: number;
  updatedAt: number;
  record: ReaderAnnotationRecord;
};

export type AnnotationListChapterGroup = {
  key: string;
  chapterIdx: number;
  title: string;
  headingLevel?: number;
  rows: AnnotationListRow[];
};

const ANNOTATION_UNGROUPED_CHAPTER_IDX = -1;

export type AnnotationRange = {
  startPhysicalLine: number;
  startColumn: number;
  endPhysicalLine: number;
  endColumn: number;
};

export function annotationPhysicalRange(
  ann: ReaderAnnotationRecord,
): AnnotationRange {
  return {
    startPhysicalLine: ann.startPhysicalLine,
    startColumn: ann.startColumn,
    endPhysicalLine: ann.endPhysicalLine,
    endColumn: ann.endColumn,
  };
}

export function physicalRangeToMonacoRange(
  range: AnnotationRange,
  physicalToDisplay: (physicalLine: number) => number,
): monaco.IRange {
  const startLine = physicalToDisplay(range.startPhysicalLine);
  const endLine = physicalToDisplay(range.endPhysicalLine);
  return {
    startLineNumber: startLine,
    startColumn: range.startColumn,
    endLineNumber: endLine,
    endColumn: range.endColumn,
  };
}

export function monacoRangeToPhysicalRange(
  range: monaco.IRange,
  displayToPhysical: (displayLine: number) => number,
): AnnotationRange {
  return {
    startPhysicalLine: displayToPhysical(range.startLineNumber),
    startColumn: range.startColumn,
    endPhysicalLine: displayToPhysical(range.endLineNumber),
    endColumn: range.endColumn,
  };
}

export function rangesEqual(a: AnnotationRange, b: AnnotationRange): boolean {
  return (
    a.startPhysicalLine === b.startPhysicalLine &&
    a.startColumn === b.startColumn &&
    a.endPhysicalLine === b.endPhysicalLine &&
    a.endColumn === b.endColumn
  );
}

export function rangesIntersect(
  a: AnnotationRange,
  b: AnnotationRange,
): boolean {
  if (a.endPhysicalLine < b.startPhysicalLine) return false;
  if (b.endPhysicalLine < a.startPhysicalLine) return false;
  if (
    a.endPhysicalLine === b.startPhysicalLine &&
    a.endColumn <= b.startColumn
  ) {
    return false;
  }
  if (
    b.endPhysicalLine === a.startPhysicalLine &&
    b.endColumn <= a.startColumn
  ) {
    return false;
  }
  return true;
}

export function rangeContainsRange(
  outer: AnnotationRange,
  inner: AnnotationRange,
): boolean {
  if (inner.startPhysicalLine < outer.startPhysicalLine) return false;
  if (inner.endPhysicalLine > outer.endPhysicalLine) return false;
  if (
    inner.startPhysicalLine === outer.startPhysicalLine &&
    inner.startColumn < outer.startColumn
  ) {
    return false;
  }
  if (
    inner.endPhysicalLine === outer.endPhysicalLine &&
    inner.endColumn > outer.endColumn
  ) {
    return false;
  }
  return true;
}

export function findAnnotationContainingRange(
  annotations: readonly ReaderAnnotationRecord[],
  inner: AnnotationRange,
): ReaderAnnotationRecord | null {
  let best: ReaderAnnotationRecord | null = null;
  let bestLen = Infinity;
  for (const ann of annotations) {
    if (ann.stale) continue;
    const outer = annotationPhysicalRange(ann);
    if (!rangeContainsRange(outer, inner)) continue;
    const len =
      (ann.endPhysicalLine - ann.startPhysicalLine) * 1_000_000 +
      (ann.endColumn - ann.startColumn);
    if (len < bestLen) {
      bestLen = len;
      best = ann;
    }
  }
  return best;
}

/** 选区与标注物理范围完全一致时绑定 */
export function findAnnotationMatchingExactSelection(
  annotations: readonly ReaderAnnotationRecord[],
  selection: monaco.IRange,
  displayToPhysical: (displayLine: number) => number,
): ReaderAnnotationRecord | null {
  const sel = monacoRangeToPhysicalRange(selection, displayToPhysical);
  for (const ann of annotations) {
    if (ann.stale) continue;
    if (rangesEqual(annotationPhysicalRange(ann), sel)) return ann;
  }
  return null;
}

export function findAnnotationsIntersectingRange(
  annotations: readonly ReaderAnnotationRecord[],
  range: AnnotationRange,
): ReaderAnnotationRecord[] {
  return annotations.filter(
    (ann) => !ann.stale && rangesIntersect(annotationPhysicalRange(ann), range),
  );
}

function comparePhysicalPosition(
  line: number,
  column: number,
  otherLine: number,
  otherColumn: number,
): number {
  if (line !== otherLine) return line - otherLine;
  return column - otherColumn;
}

/** 合并多个物理区间为最小覆盖超集 */
export function unionPhysicalRanges(
  ranges: readonly AnnotationRange[],
): AnnotationRange {
  if (ranges.length === 0) {
    throw new Error("unionPhysicalRanges: empty");
  }
  let startPhysicalLine = ranges[0]!.startPhysicalLine;
  let startColumn = ranges[0]!.startColumn;
  let endPhysicalLine = ranges[0]!.endPhysicalLine;
  let endColumn = ranges[0]!.endColumn;
  for (let i = 1; i < ranges.length; i++) {
    const r = ranges[i]!;
    if (
      comparePhysicalPosition(
        r.startPhysicalLine,
        r.startColumn,
        startPhysicalLine,
        startColumn,
      ) < 0
    ) {
      startPhysicalLine = r.startPhysicalLine;
      startColumn = r.startColumn;
    }
    if (
      comparePhysicalPosition(
        r.endPhysicalLine,
        r.endColumn,
        endPhysicalLine,
        endColumn,
      ) > 0
    ) {
      endPhysicalLine = r.endPhysicalLine;
      endColumn = r.endColumn;
    }
  }
  return {
    startPhysicalLine,
    startColumn,
    endPhysicalLine,
    endColumn,
  };
}

/** 笔记面板 / 导出等展示用：折叠空白为单空格 */
export function collapseAnnotationQuoteText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function findAnnotationAtPoint(
  annotations: readonly ReaderAnnotationRecord[],
  physicalLine: number,
  column: number,
): ReaderAnnotationRecord | null {
  const pt: AnnotationRange = {
    startPhysicalLine: physicalLine,
    startColumn: column,
    endPhysicalLine: physicalLine,
    endColumn: column + 1,
  };
  return findAnnotationContainingRange(annotations, pt);
}

export function getTextInPhysicalRange(
  model: monaco.editor.ITextModel,
  range: AnnotationRange,
  physicalToDisplay: (physicalLine: number) => number,
): string {
  const mr = physicalRangeToMonacoRange(range, physicalToDisplay);
  return model.getValueInRange(mr);
}

export function validateAnnotationAgainstModel(
  model: monaco.editor.ITextModel,
  ann: ReaderAnnotationRecord,
  physicalToDisplay: (physicalLine: number) => number,
): { valid: boolean; stale: boolean } {
  try {
    const mr = physicalRangeToMonacoRange(ann, physicalToDisplay);
    if (mr.startLineNumber < 1 || mr.endLineNumber > model.getLineCount()) {
      return { valid: false, stale: true };
    }
    const atRange = model.getValueInRange(mr);
    if (atRange === ann.text) {
      return { valid: true, stale: false };
    }
    return { valid: false, stale: true };
  } catch {
    return { valid: false, stale: true };
  }
}

export function revalidateAnnotations(
  model: monaco.editor.ITextModel,
  annotations: ReaderAnnotationRecord[],
  physicalToDisplay: (physicalLine: number) => number,
): ReaderAnnotationRecord[] {
  return annotations.map((ann) => {
    const { stale } = validateAnnotationAgainstModel(
      model,
      ann,
      physicalToDisplay,
    );
    if (!!ann.stale === stale) return ann;
    return { ...ann, stale: stale || undefined };
  });
}

export function buildAnnotationListRows(
  annotations: readonly ReaderAnnotationRecord[],
): AnnotationListRow[] {
  const rows: AnnotationListRow[] = annotations.map((ann) => {
    const hasNote = !!ann.note?.content?.trim();
    return {
      id: ann.id,
      kind: hasNote ? "note" : "lineation",
      text: ann.text,
      lineationType: ann.lineation?.type,
      colorIndex: ann.lineation?.colorIndex,
      noteContent: ann.note?.content,
      stale: ann.stale,
      createdAt: ann.createdAt,
      updatedAt: ann.updatedAt,
      record: ann,
    };
  });
  rows.sort((a, b) => {
    if (a.record.startPhysicalLine !== b.record.startPhysicalLine) {
      return (
        a.record.startPhysicalLine - b.record.startPhysicalLine ||
        a.record.startColumn - b.record.startColumn
      );
    }
    return a.record.startColumn - b.record.startColumn;
  });
  return rows;
}

/** 按标注起始位置所属章节分组；无章节表时返回单组且无标题（不展示分组头）。 */
export function groupAnnotationListRowsByChapter(
  rows: readonly AnnotationListRow[],
  chapters: readonly Chapter[],
  physicalLineToDisplayLine: (physicalLine: number) => number,
): AnnotationListChapterGroup[] {
  if (rows.length === 0) return [];
  if (chapters.length === 0) {
    return [
      {
        key: "flat",
        chapterIdx: -2,
        title: "",
        rows: [...rows],
      },
    ];
  }

  const bucket = new Map<number, AnnotationListRow[]>();
  for (const row of rows) {
    const displayLine = physicalLineToDisplayLine(row.record.startPhysicalLine);
    const idx = pickActiveChapterIdx(chapters, displayLine);
    const list = bucket.get(idx) ?? [];
    list.push(row);
    bucket.set(idx, list);
  }

  const groups: AnnotationListChapterGroup[] = [];
  const pushGroup = (
    chapterIdx: number,
    title: string,
    headingLevel?: number,
  ) => {
    const groupRows = bucket.get(chapterIdx);
    if (!groupRows?.length) return;
    groups.push({
      key: chapterIdx < 0 ? "__ungrouped__" : `ch-${chapterIdx}`,
      chapterIdx,
      title,
      headingLevel,
      rows: groupRows,
    });
    bucket.delete(chapterIdx);
  };

  pushGroup(ANNOTATION_UNGROUPED_CHAPTER_IDX, "未分章");
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!;
    const title = ch.title.trim();
    pushGroup(i, title || `第 ${i + 1} 章`, ch.headingLevel);
  }
  for (const [idx, groupRows] of bucket) {
    const ch = chapters[idx];
    groups.push({
      key: `ch-${idx}`,
      chapterIdx: idx,
      title: ch?.title?.trim() || "未分章",
      headingLevel: ch?.headingLevel,
      rows: groupRows,
    });
  }
  return groups;
}

function normalizeLineation(raw: unknown): ReaderAnnotationRecord["lineation"] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (type !== "marker" && type !== "wavy" && type !== "straight") {
    return undefined;
  }
  return {
    type,
    colorIndex: parseLineationColorIndexRaw(o.colorIndex),
  };
}

function normalizeNote(raw: unknown): ReaderAnnotationRecord["note"] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const content = typeof o.content === "string" ? o.content.trim() : "";
  if (!content) return undefined;
  const now = Date.now();
  const createdAt =
    typeof o.createdAt === "number" && Number.isFinite(o.createdAt)
      ? Math.floor(o.createdAt)
      : now;
  const updatedAt =
    typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
      ? Math.floor(o.updatedAt)
      : now;
  return { content, createdAt, updatedAt };
}

export function normalizeReaderAnnotation(
  raw: unknown,
): ReaderAnnotationRecord | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  const startPhysicalLine = Math.max(
    1,
    Math.floor(Number(o.startPhysicalLine)),
  );
  const startColumn = Math.max(1, Math.floor(Number(o.startColumn)));
  const endPhysicalLine = Math.max(
    1,
    Math.floor(Number(o.endPhysicalLine)),
  );
  const endColumn = Math.max(1, Math.floor(Number(o.endColumn)));
  const text = typeof o.text === "string" ? o.text : "";
  if (!text) return null;
  const lineation = normalizeLineation(o.lineation);
  const note = normalizeNote(o.note);
  if (!lineation && !note) return null;
  const now = Date.now();
  const createdAt =
    typeof o.createdAt === "number" && Number.isFinite(o.createdAt)
      ? Math.floor(o.createdAt)
      : now;
  const updatedAt =
    typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
      ? Math.floor(o.updatedAt)
      : now;
  const stale = o.stale === true ? true : undefined;
  return {
    id,
    startPhysicalLine,
    startColumn,
    endPhysicalLine,
    endColumn,
    text,
    lineation,
    note,
    createdAt,
    updatedAt,
    stale,
  };
}

export function normalizeReaderAnnotations(
  raw: unknown,
): ReaderAnnotationRecord[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, ReaderAnnotationRecord>();
  for (const item of raw) {
    const n = normalizeReaderAnnotation(item);
    if (n) byId.set(n.id, n);
  }
  return [...byId.values()];
}

export function createAnnotationFromRange(
  range: AnnotationRange,
  text: string,
  partial?: Partial<
    Pick<ReaderAnnotationRecord, "lineation" | "note" | "id">
  >,
): ReaderAnnotationRecord {
  const now = Date.now();
  return {
    id: partial?.id ?? crypto.randomUUID(),
    ...range,
    text,
    lineation: partial?.lineation,
    note: partial?.note,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeImportedAnnotations(
  local: ReaderAnnotationRecord[],
  imported: ReaderAnnotationRecord[],
): ReaderAnnotationRecord[] {
  const map = new Map(local.map((a) => [a.id, a]));
  for (const ann of imported) {
    map.set(ann.id, ann);
  }
  return [...map.values()];
}

