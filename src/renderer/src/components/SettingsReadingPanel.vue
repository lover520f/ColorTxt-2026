<script setup lang="ts">
import RangeSlider from "./RangeSlider.vue";
import SwitchToggle from "./SwitchToggle.vue";
import {
  lineHeightMultipleStep,
  maxFontSize,
  maxFullscreenReaderWidthPercent,
  maxLineHeightMultipleForFontSize,
  minFontSize,
  minFullscreenReaderWidthPercent,
  minLineHeightMultiple,
} from "../constants/appUi";
import { computed } from "vue";

const props = defineProps<{
  draftFontSize: number;
  draftLineHeightMultiple: number;
  draftMonacoSmoothScrolling: boolean;
  draftCompressBlankKeepOneBlank: boolean;
  draftTxtrDelimitedMatchCrossLine: boolean;
  draftFullscreenReaderWidthPercent: number;
  monacoCustomHighlight: boolean;
}>();

defineEmits<{
  "update:draftFontSize": [v: number];
  "update:draftLineHeightMultiple": [v: number];
  "update:draftMonacoSmoothScrolling": [v: boolean];
  "update:draftCompressBlankKeepOneBlank": [v: boolean];
  "update:draftTxtrDelimitedMatchCrossLine": [v: boolean];
  "update:draftFullscreenReaderWidthPercent": [v: number];
}>();

const draftMaxLineHeightMultiple = computed(() =>
  maxLineHeightMultipleForFontSize(props.draftFontSize),
);
</script>

<template>
  <div class="settingsBody">
    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel short">字号（{{ draftFontSize }} px）</span>
        <RangeSlider
          :model-value="draftFontSize"
          :min="minFontSize"
          :max="maxFontSize"
          :step="1"
          :show-percent="false"
          aria-label="阅读字号"
          @update:model-value="$emit('update:draftFontSize', $event)"
        />
      </div>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel short"
          >行高（{{ draftLineHeightMultiple.toFixed(1) }}）</span
        >
        <RangeSlider
          :model-value="draftLineHeightMultiple"
          :min="minLineHeightMultiple"
          :max="draftMaxLineHeightMultiple"
          :step="lineHeightMultipleStep"
          :show-percent="false"
          aria-label="行高倍数"
          @update:model-value="$emit('update:draftLineHeightMultiple', $event)"
        />
      </div>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel">压缩空行时保留一个空行</span>
        <SwitchToggle
          :model-value="draftCompressBlankKeepOneBlank"
          aria-label="压缩空行时保留一个空行"
          @update:model-value="
            $emit('update:draftCompressBlankKeepOneBlank', $event)
          "
        />
      </div>
      <p class="settingsHint">
        仅在开启「压缩空行」时生效，在每行下方保留一个空行。
      </p>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel">引号/括号匹配支持跨行</span>
        <SwitchToggle
          :model-value="draftTxtrDelimitedMatchCrossLine"
          :disabled="!monacoCustomHighlight"
          aria-label="引号/括号匹配支持跨行"
          @update:model-value="
            $emit('update:draftTxtrDelimitedMatchCrossLine', $event)
          "
        />
      </div>
      <p class="settingsHint">
        仅在开启「内容上色」时生效，开启后引号和括号会跨行匹配；<br />如果出现大段非引号/括号内的文本被误上色，是因为原文没有正确关闭引号/括号，可禁用该选项以降低影响范围。
      </p>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel">平滑滚动</span>
        <SwitchToggle
          :model-value="draftMonacoSmoothScrolling"
          aria-label="阅读区平滑滚动"
          @update:model-value="
            $emit('update:draftMonacoSmoothScrolling', $event)
          "
        />
      </div>
      <p class="settingsHint">关闭后，阅读区滚动不再使用平滑动画。</p>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel short"
          >全屏阅读区域宽度（{{ draftFullscreenReaderWidthPercent }}%）</span
        >
        <RangeSlider
          :model-value="draftFullscreenReaderWidthPercent"
          :min="minFullscreenReaderWidthPercent"
          :max="maxFullscreenReaderWidthPercent"
          :step="1"
          :show-percent="false"
          aria-label="全屏阅读区域宽度百分比"
          @update:model-value="
            $emit('update:draftFullscreenReaderWidthPercent', $event)
          "
        />
      </div>
      <p class="settingsHint">仅在全屏模式生效，用于控制阅读区域宽度。</p>
    </div>
  </div>
</template>

<style scoped>
.settingsBody {
  padding: 8px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  background-color: var(--bg);
  border-radius: 8px;
  /* border: 1px solid var(--border); */
}

.settingsRow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settingsRowMain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.settingsLabel {
  font-size: 14px;
  color: var(--fg);
  flex: 1 1 60%;
  min-width: 60%;
}
.settingsLabel.short {
  flex: 1 1 30%;
  min-width: 30%;
}

.settingsHint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--muted);
}
</style>
