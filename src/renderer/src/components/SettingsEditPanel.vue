<script setup lang="ts">
import SwitchToggle from "./SwitchToggle.vue";

defineProps<{
  draftReaderEditShowLineNumbers: boolean;
  draftReaderEditMinimap: boolean;
  draftEditAutoRefreshChapterList: boolean;
}>();

defineEmits<{
  "update:draftReaderEditShowLineNumbers": [v: boolean];
  "update:draftReaderEditMinimap": [v: boolean];
  "update:draftEditAutoRefreshChapterList": [v: boolean];
}>();
</script>

<template>
  <div class="settingsBody">
    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel">显示行号</span>
        <SwitchToggle
          :model-value="draftReaderEditShowLineNumbers"
          aria-label="显示行号"
          @update:model-value="
            $emit('update:draftReaderEditShowLineNumbers', $event)
          "
        />
      </div>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel">启用小地图</span>
        <SwitchToggle
          :model-value="draftReaderEditMinimap"
          aria-label="启用小地图"
          @update:model-value="$emit('update:draftReaderEditMinimap', $event)"
        />
      </div>
    </div>

    <div class="settingsRow">
      <div class="settingsRowMain">
        <span class="settingsLabel">自动刷新章节列表</span>
        <SwitchToggle
          :model-value="draftEditAutoRefreshChapterList"
          aria-label="自动刷新章节列表"
          @update:model-value="
            $emit('update:draftEditAutoRefreshChapterList', $event)
          "
        />
      </div>
      <p class="settingsHint">
        如果内容少于 30 万行，内容变更时同步更新章节列表。
      </p>
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

.settingsHint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--muted);
}
</style>
