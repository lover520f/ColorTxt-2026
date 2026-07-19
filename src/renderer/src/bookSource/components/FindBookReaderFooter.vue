<script setup lang="ts">
withDefaults(
  defineProps<{
    loading?: boolean;
    /** 是否已有可读章节内容（用于占位与统计展示） */
    hasContent?: boolean;
    readingProgressPercentPart: string;
    readingProgressDetailPart: string;
    readingProgressPlaceholder: boolean;
    readingProgressComplete: boolean;
    chapterCharCountText: string;
  }>(),
  {
    loading: false,
    hasContent: false,
  },
);
</script>

<template>
  <footer class="findBookReaderFooter">
    <div class="findBookReaderFooterLeft" />
    <div class="findBookReaderFooterRight">
      <span v-if="loading" class="findBookReaderFooterLoading">加载中...</span>
      <template v-else-if="hasContent">
        <span>
          阅读进度：<span
            class="findBookReaderFooterProgressPct"
            :class="{
              'findBookReaderFooterProgressPct--placeholder':
                readingProgressPlaceholder,
              'findBookReaderFooterProgressPct--complete':
                readingProgressComplete,
            }"
            >{{ readingProgressPercentPart }}</span
          >{{ readingProgressDetailPart }}
        </span>
        <span>章节字数：{{ chapterCharCountText }}</span>
      </template>
    </div>
  </footer>
</template>

<style scoped>
.findBookReaderFooter {
  height: 28px;
  flex-shrink: 0;
  min-width: 0;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  gap: 16px;
  background: var(--bg);
  user-select: none;
}

.findBookReaderFooterLeft {
  min-width: 0;
  flex: 1;
}

.findBookReaderFooterRight {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  display: inline-flex;
  min-width: 0;
  flex-shrink: 0;
  gap: 20px;
}

.findBookReaderFooterLoading {
  flex-shrink: 0;
}

.findBookReaderFooterProgressPct {
  color: var(--warning);
}

.findBookReaderFooterProgressPct--placeholder {
  color: var(--muted);
}

.findBookReaderFooterProgressPct--complete {
  color: var(--success);
}
</style>
