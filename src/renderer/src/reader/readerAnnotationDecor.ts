import * as monaco from "monaco-editor";
import {
  clampLineationColorIndex,
  lineationColorAt,
} from "../constants/annotationColors";
import {
  annotationPhysicalRange,
  physicalColumnToDisplayColumn,
  physicalRangeToMonacoRange,
  type AnnotationColumnMapOptions,
} from "../utils/readerAnnotations";
import type {
  ReaderAnnotationRecord,
  ReaderLineationType,
} from "../stores/fileMetaStore";

export type AnnotationCompactHit = {
  annotationId: string;
  startColumn: number;
  endColumnExclusive: number;
  lineationType?: ReaderLineationType;
  colorIndex?: number;
  hasNote: boolean;
  noteContent?: string;
};

export const ANNOTATION_VIEWPORT_BUFFER_LINES = 80;
export const ANNOTATION_VIEWPORT_SYNC_MS = 48;

export function buildAnnotationHitsByDisplayLine(
  annotations: readonly ReaderAnnotationRecord[],
  physicalToDisplay: (physicalLine: number) => number,
  getPhysicalLineContent: (physicalLine: number) => string,
  columnMap: AnnotationColumnMapOptions,
  lineationColorCount?: number,
): Map<number, AnnotationCompactHit[]> {
  const map = new Map<number, AnnotationCompactHit[]>();
  for (const ann of annotations) {
    if (ann.stale) continue;
    for (
      let physicalLine = ann.startPhysicalLine;
      physicalLine <= ann.endPhysicalLine;
      physicalLine += 1
    ) {
      const displayLine = physicalToDisplay(physicalLine);
      const rawLine = getPhysicalLineContent(physicalLine);
      let startColumn = 1;
      let endColumnExclusive = Number.MAX_SAFE_INTEGER;
      if (physicalLine === ann.startPhysicalLine) {
        startColumn = physicalColumnToDisplayColumn(
          rawLine,
          ann.startColumn,
          columnMap,
        );
      }
      if (physicalLine === ann.endPhysicalLine) {
        endColumnExclusive = physicalColumnToDisplayColumn(
          rawLine,
          ann.endColumn,
          columnMap,
        );
      }
      const hits = map.get(displayLine) ?? [];
      const rawColorIndex = ann.lineation?.colorIndex;
      hits.push({
        annotationId: ann.id,
        startColumn,
        endColumnExclusive,
        lineationType: ann.lineation?.type,
        colorIndex:
          ann.lineation?.type != null && lineationColorCount != null
            ? clampLineationColorIndex(rawColorIndex ?? 0, lineationColorCount)
            : rawColorIndex,
        hasNote: !!ann.note?.content?.trim(),
        noteContent: ann.note?.content,
      });
      map.set(displayLine, hits);
    }
  }
  return map;
}

function annotationInlineClassName(hit: AnnotationCompactHit): string {
  const parts = ["readerAnnotationHit"];
  const colorIdx = hit.colorIndex ?? 0;
  if (hit.lineationType === "marker") {
    parts.push("readerAnnotationMarker");
    parts.push(`readerAnnotationMarker--${colorIdx}`);
  } else if (hit.lineationType === "wavy") {
    parts.push("readerAnnotationWavy");
    parts.push(`readerAnnotationWavy--${colorIdx}`);
  } else if (hit.lineationType === "straight") {
    parts.push("readerAnnotationStraight");
    parts.push(`readerAnnotationStraight--${colorIdx}`);
  } else if (hit.hasNote) {
    parts.push("readerAnnotationNoteOnly");
  }
  return parts.join(" ");
}

export function buildAnnotationDecorationsForViewport(
  lo: number,
  hi: number,
  hitsByLine: Map<number, AnnotationCompactHit[]>,
  model: monaco.editor.ITextModel,
  options?: { suppressNoteHoverForAnnotationId?: string | null },
): monaco.editor.IModelDeltaDecoration[] {
  const suppressId = options?.suppressNoteHoverForAnnotationId ?? null;
  const decs: monaco.editor.IModelDeltaDecoration[] = [];
  for (let line = lo; line <= hi; line++) {
    const hits = hitsByLine.get(line);
    if (!hits?.length) continue;
    const maxCol = model.getLineMaxColumn(line);
    for (const h of hits) {
      const endCol = Math.min(h.endColumnExclusive, maxCol);
      const startCol = Math.min(h.startColumn, maxCol);
      if (startCol >= endCol) continue;
      const showNoteHover =
        !!h.noteContent &&
        (!suppressId || h.annotationId !== suppressId);
      decs.push({
        range: new monaco.Range(line, startCol, line, endCol),
        options: {
          inlineClassName: annotationInlineClassName(h),
          hoverMessage: showNoteHover
            ? { value: h.noteContent! }
            : undefined,
          stickiness:
            monaco.editor.TrackedRangeStickiness
              .NeverGrowsWhenTypingAtEdges,
        },
      });
    }
  }
  return decs;
}

/** 笔记-only 虚线：1px、短间隔 dash，接近微信读书 */
export const READER_ANNOTATION_NOTE_ONLY_CSS_RULE =
  ".monaco-editor .view-lines .view-line span.readerAnnotationNoteOnly { text-decoration: none !important; background-image: repeating-linear-gradient(90deg, color-mix(in srgb, var(--vscode-editor-foreground, #888) 32%, transparent) 0, color-mix(in srgb, var(--vscode-editor-foreground, #888) 32%, transparent) 4px, transparent 4px, transparent 6px) !important; background-size: 6px 1px !important; background-repeat: repeat-x !important; background-position: 0 100% !important; padding-bottom: 2px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; }";

export function annotationMarkerCssRules(
  colors: readonly string[],
): string {
  const rules: string[] = [
    ".monaco-editor .view-lines .view-line span.readerAnnotationHit { cursor: pointer; box-decoration-break: clone; -webkit-box-decoration-break: clone; }",
    READER_ANNOTATION_NOTE_ONLY_CSS_RULE,
  ];
  for (let i = 0; i < colors.length; i++) {
    const c = lineationColorAt(i, colors);
    rules.push(
      `.monaco-editor .view-lines .view-line span.readerAnnotationMarker--${i} { background-color: color-mix(in srgb, ${c} 35%, transparent) !important; border-radius: 2px; }`,
      `.monaco-editor .view-lines .view-line span.readerAnnotationWavy--${i} { text-decoration: underline wavy ${c} !important; text-decoration-thickness: 2px; text-underline-offset: 4px; }`,
      `.monaco-editor .view-lines .view-line span.readerAnnotationStraight--${i} { text-decoration: underline solid ${c} !important; text-decoration-thickness: 2px; text-underline-offset: 4px; }`,
    );
  }
  return rules.join("\n");
}

export function monacoRangeFromAnnotation(
  ann: ReaderAnnotationRecord,
  physicalToDisplay: (n: number) => number,
  getPhysicalLineContent: (physicalLine: number) => string,
  columnMap: AnnotationColumnMapOptions,
): monaco.IRange {
  return physicalRangeToMonacoRange(
    annotationPhysicalRange(ann),
    physicalToDisplay,
    getPhysicalLineContent,
    columnMap,
  );
}
