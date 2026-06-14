<script setup lang="ts">
defineProps<{
  activeTab: "reader" | "highlight" | "lineation";
}>();

const emit = defineEmits<{
  "update:activeTab": [value: "reader" | "highlight" | "lineation"];
}>();
</script>

<template>
  <div class="colorSchemeTabBar" role="tablist" aria-label="配色分类">
    <div class="tabs">
      <button
        type="button"
        role="tab"
        class="tabBtn"
        :class="{ active: activeTab === 'reader' }"
        :aria-selected="activeTab === 'reader'"
        @click="emit('update:activeTab', 'reader')"
      >
        阅读器
      </button>
      <button
        type="button"
        role="tab"
        class="tabBtn"
        :class="{ active: activeTab === 'highlight' }"
        :aria-selected="activeTab === 'highlight'"
        @click="emit('update:activeTab', 'highlight')"
      >
        高亮色
      </button>
      <button
        type="button"
        role="tab"
        class="tabBtn"
        :class="{ active: activeTab === 'lineation' }"
        :aria-selected="activeTab === 'lineation'"
        @click="emit('update:activeTab', 'lineation')"
      >
        标注色
      </button>
    </div>
  </div>
</template>

<style scoped>
.colorSchemeTabBar {
  flex-shrink: 0;
  margin-bottom: 0;
  border-bottom: 1px solid var(--border);
}

.tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tabBtn {
  box-sizing: border-box;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--tab-fg);
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
}

.tabBtn:hover {
  color: var(--tab-fg-hover);
  background: transparent;
}

.tabBtn.active {
  color: var(--tab-fg-active);
  background: transparent;
  border-bottom: 2px solid var(--tab-underline);
  font-weight: 600;
}
</style>
