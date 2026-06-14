<script setup lang="ts">
import { computed } from "vue";
import { lineationColorAt } from "../constants/annotationColors";
import { icons } from "../icons";
import type {
  ReaderLineationType,
  ReaderAnnotationRecord,
} from "../stores/fileMetaStore";

type ToolbarAction =
  | "copy"
  | "highlight"
  | "marker"
  | "wavy"
  | "straight"
  | "deleteLineation"
  | "note"
  | "askAi";

const props = defineProps<{
  toolbarVisible: boolean;
  colorPickerMode: null | "highlight" | "lineation";
  lineationPickerType: ReaderLineationType | null;
  floatCenterX: number;
  floatRootTop: number;
  openDownward: boolean;
  highlightColors: readonly string[];
  lineationColors: readonly string[];
  showHighlightRemoveRow: boolean;
  existingHighlightColorIndex: number | null;
  activeLineation?: ReaderAnnotationRecord["lineation"];
  lineationPickerSelectedIndex: number;
  monacoCustomHighlight: boolean;
  aiFeaturesEnabled: boolean;
  hasLineation: boolean;
  hasNote: boolean;
}>();

const emit = defineEmits<{
  action: [action: ToolbarAction];
  highlightPickConfirm: [colorIndex: number];
  highlightPickRemove: [];
  lineationPickConfirm: [colorIndex: number];
}>();

const lineationActions: Array<{
  id: "marker" | "wavy" | "straight";
  label: string;
  type: ReaderLineationType;
}> = [
  { id: "marker", label: "马克笔", type: "marker" },
  { id: "wavy", label: "波浪线", type: "wavy" },
  { id: "straight", label: "直线", type: "straight" },
];

const pickerVisible = computed(
  () => props.toolbarVisible && props.colorPickerMode !== null,
);

const floatVisible = computed(
  () => props.toolbarVisible || pickerVisible.value,
);

function isLineationActive(type: ReaderLineationType): boolean {
  return props.activeLineation?.type === type;
}

function lineationAccent(type: ReaderLineationType): string | undefined {
  if (!isLineationActive(type)) return undefined;
  return lineationColorAt(
    props.activeLineation!.colorIndex ?? 0,
    props.lineationColors,
  );
}

function isHighlightActive(): boolean {
  const idx = props.existingHighlightColorIndex;
  return (
    props.colorPickerMode === "highlight" ||
    (idx != null && idx < props.highlightColors.length)
  );
}

function noteIconAccentStyle(): Record<string, string> | undefined {
  if (!props.hasNote || !props.activeLineation) return undefined;
  const color = lineationColorAt(
    props.activeLineation.colorIndex ?? 0,
    props.lineationColors,
  );
  return { color };
}

function onLineationAction(type: ReaderLineationType) {
  if (type === "marker") emit("action", "marker");
  else if (type === "wavy") emit("action", "wavy");
  else emit("action", "straight");
}

function isPickerSwatchSelected(index: number): boolean {
  if (props.colorPickerMode === "highlight") {
    return (
      props.existingHighlightColorIndex === index &&
      props.existingHighlightColorIndex < props.highlightColors.length
    );
  }
  return props.lineationPickerSelectedIndex === index;
}
</script>

<template>
  <div
    v-show="floatVisible"
    class="selFloatRoot"
    :class="{ selFloatRootDown: openDownward }"
    :style="{
      top: `${floatRootTop}px`,
      left: `${floatCenterX}px`,
    }"
  >
    <div v-show="pickerVisible" class="selPicker">
      <div
        class="selPickerBody"
        :class="{
          'selPickerBody--withRemove':
            colorPickerMode === 'highlight' && showHighlightRemoveRow,
        }"
      >
        <div
          v-if="colorPickerMode === 'highlight' && showHighlightRemoveRow"
          class="selPickerRemoveCol"
        >
          <button
            type="button"
            class="selSwatch selRemoveKeyword"
            aria-label="移除该高亮词"
            @click="emit('highlightPickRemove')"
          >
            <span
              class="selRemoveKeywordInner"
              aria-hidden="true"
              v-html="icons.clear"
            ></span>
          </button>
        </div>
        <div class="selSwatchRow selPickerColorsCol">
          <button
            v-for="(c, i) in colorPickerMode === 'highlight'
              ? highlightColors
              : lineationColors"
            :key="i"
            type="button"
            class="selSwatch"
            :aria-pressed="isPickerSwatchSelected(i)"
            :style="{ backgroundColor: c }"
            :aria-label="`使用颜色 ${i + 1}`"
            @click="
              colorPickerMode === 'highlight'
                ? emit('highlightPickConfirm', i)
                : emit('lineationPickConfirm', i)
            "
          >
            <span
              v-if="isPickerSwatchSelected(i)"
              class="selSwatchCheck"
              aria-hidden="true"
            >
              <svg viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 8.2 6.5 11.2 12.5 4.8"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-show="toolbarVisible" class="selToolbar">
      <button
        type="button"
        class="selAction"
        aria-label="复制"
        @pointerdown.prevent="emit('action', 'copy')"
      >
        <span class="selActionIcon" aria-hidden="true" v-html="icons.copy"></span>
        <span class="selActionLabel">复制</span>
      </button>
      <button
        v-if="monacoCustomHighlight"
        type="button"
        class="selAction selAction--colorIcon"
        :class="{ 'selAction--highlightActive': isHighlightActive() }"
        aria-label="高亮词"
        @pointerdown.prevent="emit('action', 'highlight')"
      >
        <span
          class="selActionIcon"
          aria-hidden="true"
          v-html="icons.highlightMark"
        ></span>
        <span class="selActionLabel">高亮词</span>
      </button>
      <button
        v-for="item in lineationActions"
        :key="item.id"
        type="button"
        class="selAction"
        :class="{ 'selAction--lineationActive': isLineationActive(item.type) }"
        :style="
          isLineationActive(item.type)
            ? ({ '--lineation-accent': lineationAccent(item.type) } as Record<
                string,
                string
              >)
            : undefined
        "
        :aria-label="item.label"
        @pointerdown.prevent="onLineationAction(item.type)"
      >
        <span
          class="selActionIcon selLineationIcon"
          :class="{
            'selLineationIcon--active': isLineationActive(item.type),
            'selLineationIcon--marker': item.type === 'marker',
            'selLineationIcon--wavy': item.type === 'wavy',
            'selLineationIcon--straight': item.type === 'straight',
          }"
          aria-hidden="true"
        >
          <span
            v-if="item.type === 'marker'"
            class="selLineationMarkerBg"
          ></span>
          <span
            v-if="item.type === 'wavy' || item.type === 'straight'"
            class="selLineationGlyphWrap"
          >
            <span class="selLineationGlyph" v-html="icons.fontFamily"></span>
            <svg
              v-if="item.type === 'wavy'"
              class="selLineationDeco selLineationDeco--wavy"
              viewBox="0 0 18 4"
              width="18"
              height="3"
              aria-hidden="true"
            >
              <path
                d="M0 3Q1.8 1 3.6 3T7.2 3T10.8 3T14.4 3T18 3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg
              v-if="item.type === 'straight'"
              class="selLineationDeco selLineationDeco--straight"
              viewBox="0 0 16 2"
              width="16"
              height="2"
              aria-hidden="true"
            >
              <line
                x1="0"
                y1="1"
                x2="16"
                y2="1"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span
            v-else
            class="selLineationGlyph"
            v-html="icons.fontFamily"
          ></span>
        </span>
        <span class="selActionLabel">{{ item.label }}</span>
      </button>
      <button
        v-if="hasLineation"
        type="button"
        class="selAction"
        aria-label="删除划线"
        @pointerdown.prevent="emit('action', 'deleteLineation')"
      >
        <span
          class="selActionIcon"
          aria-hidden="true"
          v-html="icons.deleteLineation"
        ></span>
        <span class="selActionLabel">删除划线</span>
      </button>
      <button
        type="button"
        class="selAction"
        :class="{ 'selAction--noteActive': hasNote }"
        aria-label="记笔记"
        @pointerdown.prevent="emit('action', 'note')"
      >
        <span
          class="selActionIcon"
          :style="noteIconAccentStyle()"
          aria-hidden="true"
          v-html="icons.note"
        ></span>
        <span class="selActionLabel">记笔记</span>
      </button>
      <button
        v-if="aiFeaturesEnabled"
        type="button"
        class="selAction"
        aria-label="问 AI"
        @pointerdown.prevent="emit('action', 'askAi')"
      >
        <span class="selActionIcon" aria-hidden="true" v-html="icons.aiChat"></span>
        <span class="selActionLabel">问 AI</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.selFloatRoot {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  transform: translate(-50%, -100%);
}

.selFloatRootDown {
  flex-direction: column-reverse;
  transform: translate(-50%, 0);
}

.selToolbar,
.selPicker {
  pointer-events: auto;
}

.selToolbar,
.selPicker {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: 0 4px 16px color-mix(in srgb, #000 18%, transparent);
}

.selToolbar {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
}

.selPicker {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  padding: 10px 12px;
}

.selPickerBody--withRemove {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  width: fit-content;
}

.selPickerRemoveCol {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.selPickerColorsCol {
  flex: 0 0 auto;
}

.selAction {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  padding: 4px 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}

.selAction:hover:not(:disabled) {
  background: var(--icon-btn-bg-hover);
}

.selAction--lineationActive,
.selAction--lineationActive:hover:not(:disabled),
.selAction--highlightActive,
.selAction--highlightActive:hover:not(:disabled),
.selAction--noteActive,
.selAction--noteActive:hover:not(:disabled) {
  background: var(--icon-btn-bg-hover);
}

.selAction:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.selActionIcon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  color: var(--fg);
  pointer-events: none;
}

.selActionIcon:not(.selLineationIcon) :deep(svg) {
  width: 20px;
  height: 20px;
  display: block;
}

.selAction:not(.selAction--colorIcon) .selActionIcon:not(.selLineationIcon) :deep(svg path) {
  fill: currentColor;
}

.selActionLabel {
  font-size: 10px;
  line-height: 1.1;
  white-space: nowrap;
  pointer-events: none;
}

.selLineationIcon {
  position: relative;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.selLineationIcon--wavy,
.selLineationIcon--straight {
  justify-content: center;
}

.selLineationMarkerBg {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 3px;
  background: color-mix(in srgb, var(--icon-btn-bg-hover) 45%, var(--bg));
}

.selLineationIcon--active.selLineationIcon--marker .selLineationMarkerBg {
  background: color-mix(in srgb, var(--lineation-accent) 45%, transparent);
}

.selLineationGlyph {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--fg);
}

.selLineationGlyph :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}

.selLineationGlyphWrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  line-height: 0;
  flex: 0 0 auto;
}

.selLineationIcon--wavy .selLineationGlyph :deep(svg),
.selLineationIcon--straight .selLineationGlyph :deep(svg) {
  width: 15px;
  height: 15px;
  display: block;
}

.selLineationGlyph :deep(svg path) {
  fill: currentColor;
}

.selLineationDeco {
  display: block;
  flex: 0 0 auto;
  width: 16px;
  color: var(--fg);
  overflow: visible;
}

.selLineationDeco--wavy {
  width: 18px;
  height: 3px;
  margin-top: -1px;
}

.selLineationDeco--straight {
  height: 2px;
}

.selLineationDeco path,
.selLineationDeco line {
  fill: none;
  stroke: currentColor;
  vector-effect: non-scaling-stroke;
}

.selLineationIcon--active .selLineationDeco {
  color: var(--lineation-accent);
}

/** 5 列色块：26×5 + 8×4 = 162px；超出则换行，width:fit-content 避免未满行时右侧空带 */
.selSwatchRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: fit-content;
  max-width: 162px;
}

.selSwatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 2px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
}

.selSwatch:hover {
  transform: scale(1.08);
}

/** 与色盘背景同色，视觉上等同镂空 */
.selSwatchCheck {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--bg);
  pointer-events: none;
}

.selSwatchCheck svg {
  width: 100%;
  height: 100%;
  display: block;
}

.selSwatch.selRemoveKeyword {
  border: none;
  padding: 0;
  overflow: hidden;
  background: var(--bg);
}

.selSwatch.selRemoveKeyword .selRemoveKeywordInner {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
}

.selSwatch.selRemoveKeyword .selRemoveKeywordInner :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.selSwatch.selRemoveKeyword .selRemoveKeywordInner :deep(svg path) {
  fill: var(--danger);
}
</style>
