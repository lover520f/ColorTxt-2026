<script setup lang="ts">
withDefaults(
  defineProps<{
    /** SVG 字符串，与 icons.xxx 一致 */
    iconHtml: string;
    title?: string;
    /** 图标按钮无文字时建议设置，便于读屏 */
    ariaLabel?: string;
    active?: boolean;
    /** 有值时设置 aria-pressed（切换型按钮） */
    pressed?: boolean;
    /** 多色 SVG，不强制 path 为 currentColor */
    multicolor?: boolean;
    disabled?: boolean;
    /** 表格操作列等：32×32、图标 18px */
    large?: boolean;
    /** 编辑态「格式化」类操作：图标使用主题色，与只读切换按钮区分 */
    primary?: boolean;
  }>(),
  { active: false, multicolor: false, disabled: false, large: false, primary: false },
);

defineEmits<{ click: [e: MouseEvent] }>();
</script>

<template>
  <button
    type="button"
    class="iconBtn"
    :class="{ active, large, primary }"
    :title="title"
    :aria-label="ariaLabel"
    :aria-pressed="pressed"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <span
      class="icon"
      :class="{ 'icon--multicolor': multicolor }"
      v-html="iconHtml"
    ></span>
  </button>
</template>

<style scoped>
.iconBtn {
  background: transparent;
  border: none;
  border-radius: 4px;
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.16s ease;
}

.iconBtn:hover:not(:disabled) {
  background: var(--icon-btn-bg-hover);
}

.icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  color: var(--icon-btn-fg);
}

.icon :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}

.icon:not(.icon--multicolor) :deep(path) {
  fill: currentColor;
}

.iconBtn:hover:not(:disabled) .icon:not(.icon--multicolor) {
  color: var(--icon-btn-fg);
}

.iconBtn:focus {
  outline: none;
}

.iconBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.iconBtn.active {
  background: var(--icon-btn-bg-active);
}

.iconBtn.active .icon:not(.icon--multicolor) {
  color: var(--icon-btn-fg);
}

.iconBtn.primary {
  background: var(--primary);
}
.iconBtn.primary:hover:not(:disabled) {
  background: var(--primary-hover);
}
.iconBtn.primary .icon:not(.icon--multicolor) {
  color: #ffffff;
}
.iconBtn.primary:hover:not(:disabled) .icon:not(.icon--multicolor) {
  color: #ffffff;
}
</style>
