<script setup lang="ts">
import SwitchToggle from "../../components/SwitchToggle.vue";

defineProps<{
  draftReaderEditShowLineNumbers: boolean;
  draftReaderEditMinimap: boolean;
}>();

defineEmits<{
  "update:draftReaderEditShowLineNumbers": [v: boolean];
  "update:draftReaderEditMinimap": [v: boolean];
}>();
</script>

<template>
  <div class="settingsEditRoot">
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
    </div>
  </div>
</template>

<style scoped>
.settingsEditRoot {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settingsBody {
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
  white-space: nowrap;
  flex: 1 1 60%;
}
</style>
