<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const timeText = ref("");
let alignTimer: number | null = null;
let minuteTimer: number | null = null;

function formatNow(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function tick() {
  timeText.value = formatNow();
}

function clearTimers() {
  if (alignTimer != null) {
    window.clearTimeout(alignTimer);
    alignTimer = null;
  }
  if (minuteTimer != null) {
    window.clearInterval(minuteTimer);
    minuteTimer = null;
  }
}

function start() {
  tick();
  clearTimers();
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  alignTimer = window.setTimeout(() => {
    alignTimer = null;
    tick();
    minuteTimer = window.setInterval(tick, 60_000);
  }, msToNextMinute);
}

function stop() {
  clearTimers();
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) start();
    else stop();
  },
  { immediate: true },
);

onUnmounted(stop);
</script>

<template>
  <div
    v-if="visible"
    class="fullscreenSystemClock"
    aria-hidden="true"
  >
    {{ timeText }}
  </div>
</template>

<style scoped>
.fullscreenSystemClock {
  position: absolute;
  left: 0;
  bottom: 0;
  z-index: 40;
  pointer-events: none;
  padding: 6px 10px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  background: var(--reader-bg);
  color: color-mix(in srgb, var(--reader-body-text) 50%, transparent);
  user-select: none;
}
</style>
