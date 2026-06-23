import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type ReaderMain from "../components/ReaderMain.vue";
import {
  clampTimedScrollIntervalMs,
  type TimedScrollSettings,
} from "../constants/timedScroll";

export function useAppTimedScroll(deps: {
  readerRef: Ref<InstanceType<typeof ReaderMain> | null>;
  timedScrollSettings: Ref<TimedScrollSettings>;
  currentFile: Ref<string | null>;
  loading: Ref<boolean>;
  readerEditMode: Ref<boolean>;
  viewportAtBottom: Ref<boolean>;
  isVoiceReadActive: Ref<boolean>;
}) {
  const active = ref(false);
  let timerId: ReturnType<typeof setInterval> | null = null;

  function clearTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function stopTimedScroll() {
    active.value = false;
    clearTimer();
  }

  function tick() {
    if (!active.value) return;
    if (deps.viewportAtBottom.value) {
      stopTimedScroll();
      return;
    }
    const reader = deps.readerRef.value;
    if (!reader) return;
    if (deps.timedScrollSettings.value.range === "line") {
      reader.scrollByLineStep?.(1);
    } else {
      reader.scrollByPageStep?.(1);
    }
  }

  function startTimer() {
    clearTimer();
    const ms = clampTimedScrollIntervalMs(
      deps.timedScrollSettings.value.intervalMs,
    );
    timerId = setInterval(tick, ms);
  }

  function startTimedScroll() {
    if (!canStartTimedScroll.value) return;
    if (deps.isVoiceReadActive.value) return;
    active.value = true;
    startTimer();
  }

  function toggleTimedScroll() {
    if (active.value) {
      stopTimedScroll();
      return;
    }
    startTimedScroll();
  }

  const canStartTimedScroll = computed(() => {
    if (!deps.currentFile.value?.trim()) return false;
    if (deps.loading.value) return false;
    if (deps.readerEditMode.value) return false;
    if (deps.isVoiceReadActive.value) return false;
    if (deps.viewportAtBottom.value) return false;
    const n = deps.readerRef.value?.getModelLineCount?.() ?? 0;
    return n > 0;
  });

  watch(
    () => deps.timedScrollSettings.value,
    () => {
      if (active.value) startTimer();
    },
    { deep: true },
  );

  watch(deps.currentFile, () => stopTimedScroll());
  watch(deps.readerEditMode, (ed) => {
    if (ed) stopTimedScroll();
  });
  watch(deps.loading, (ld) => {
    if (ld) stopTimedScroll();
  });
  watch(deps.isVoiceReadActive, (vr) => {
    if (vr) stopTimedScroll();
  });
  watch(deps.viewportAtBottom, (atBottom) => {
    if (atBottom && active.value) stopTimedScroll();
  });

  onBeforeUnmount(() => stopTimedScroll());

  return {
    isTimedScrollActive: active,
    canStartTimedScroll,
    toggleTimedScroll,
    stopTimedScroll,
  };
}
