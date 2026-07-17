<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  watchEffect,
} from "vue";

const props = withDefaults(
  defineProps<{
    /** 列表项数量 */
    itemCount: number;
    /** 单行高度（px），与行内内容样式一致 */
    rowStride: number;
    /** 视口外多渲染的行数 */
    overscan?: number;
    /** scrollToIndex(align:auto) 时与视口边缘的留白（px） */
    scrollPadding?: number;
    /** 稳定 :key，默认使用 index */
    itemKey?: (index: number) => string | number;
    /**
     * 外层滚动容器：由该元素的 scrollTop / 视口驱动可见区间，
     * 本组件只占位 totalHeight，自身不再产生滚动条。
     */
    externalScrollEl?: HTMLElement | null;
  }>(),
  { overscan: 10, scrollPadding: 5 },
);

const emit = defineEmits<{
  /** 当前虚拟窗下标（含 overscan），供封面等按可见项懒加载 */
  visibleIndices: [indices: number[]];
}>();

/** 内置滚动模式时的滚动宿；外层模式时指向占位根（非滚动） */
const scrollEl = ref<HTMLDivElement | null>(null);
const listRootEl = ref<HTMLDivElement | null>(null);

/**
 * 相对列表顶部的滚动偏移（可为负：列表尚未进入视口）。
 * 内置模式下等同 scrollTop（≥0）。
 */
const listScrollOffset = ref(0);
const listViewportHeight = ref(240);

/** 取消进行中的 rAF 平滑滚动（原生 scrollTo(smooth) 在部分 Electron/WebView 下几乎无动画） */
let cancelPendingSmoothScroll: (() => void) | null = null;

const useExternalScroll = computed(() => Boolean(props.externalScrollEl));

const totalHeight = computed(() =>
  Math.max(0, props.itemCount * props.rowStride),
);

const virtualWindow = computed(() => {
  const n = props.itemCount;
  const stride = props.rowStride;
  const scrollTop = listScrollOffset.value;
  const viewport = Math.max(1, listViewportHeight.value);
  const os = props.overscan ?? 10;
  if (n <= 0) {
    return { start: 0, end: 0, offsetY: 0, indices: [] as number[] };
  }
  const start = Math.max(0, Math.floor(scrollTop / stride) - os);
  const end = Math.min(n, Math.ceil((scrollTop + viewport) / stride) + os);
  const indices: number[] = [];
  for (let i = start; i < end; i++) indices.push(i);
  return { start, end, offsetY: start * stride, indices };
});

function resolveKey(index: number): string | number {
  return props.itemKey?.(index) ?? index;
}

function measureListOffsetInHost(host: HTMLElement, root: HTMLElement): number {
  const hostRect = host.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return rootRect.top - hostRect.top + host.scrollTop;
}

function syncFromExternal() {
  const host = props.externalScrollEl;
  const root = listRootEl.value;
  if (!host || !root) return;
  if (host.clientHeight > 0) {
    listViewportHeight.value = host.clientHeight;
  }
  const listOffsetTop = measureListOffsetInHost(host, root);
  listScrollOffset.value = host.scrollTop - listOffsetTop;
}

function onInternalScroll(e: Event) {
  if (useExternalScroll.value) return;
  listScrollOffset.value = (e.target as HTMLElement).scrollTop;
}

function getScrollHost(): HTMLElement | null {
  return useExternalScroll.value
    ? (props.externalScrollEl ?? null)
    : scrollEl.value;
}

watchEffect((onCleanup) => {
  if (useExternalScroll.value) {
    const host = props.externalScrollEl;
    if (!host) return;

    const onScroll = () => syncFromExternal();
    host.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => syncFromExternal());
    ro.observe(host);
    for (const child of Array.from(host.children)) {
      ro.observe(child);
    }
    const root = listRootEl.value;
    if (root) ro.observe(root);

    syncFromExternal();
    void nextTick(syncFromExternal);

    onCleanup(() => {
      host.removeEventListener("scroll", onScroll);
      ro.disconnect();
    });
    return;
  }

  const el = scrollEl.value;
  if (!el) return;
  let lastClientH = 0;
  const update = () => {
    const h = el.clientHeight;
    if (h > 0) listViewportHeight.value = h;
    if (h > 0 && lastClientH === 0) {
      el.scrollTop = Math.max(0, listScrollOffset.value);
      listScrollOffset.value = el.scrollTop;
    }
    lastClientH = h;
  };
  update();
  const ro = new ResizeObserver(() => update());
  ro.observe(el);
  onCleanup(() => ro.disconnect());
});

onBeforeUnmount(() => {
  cancelPendingSmoothScroll?.();
  cancelPendingSmoothScroll = null;
});

watch(
  () => props.itemCount,
  (newCount, oldCount) => {
    void nextTick(() => {
      if (useExternalScroll.value) {
        syncFromExternal();
        return;
      }
      const el = scrollEl.value;
      if (!el) return;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      let nextTop = el.scrollTop;
      if (nextTop > maxScroll) {
        nextTop = maxScroll;
      }
      if (
        oldCount !== newCount ||
        Math.abs(listScrollOffset.value - nextTop) > 0.5
      ) {
        el.scrollTop = nextTop;
        listScrollOffset.value = nextTop;
      }
      if (oldCount !== newCount && el.clientHeight > 0) {
        void nextTick(() => {
          const max2 = Math.max(0, el.scrollHeight - el.clientHeight);
          const top = Math.min(Math.max(0, listScrollOffset.value), max2);
          el.scrollTop = top;
          listScrollOffset.value = top;
        });
      }
    });
  },
);

function scrollToTop() {
  const host = getScrollHost();
  if (!host) return;
  if (useExternalScroll.value) {
    const root = listRootEl.value;
    if (!root) return;
    const listOffsetTop = measureListOffsetInHost(host, root);
    host.scrollTop = Math.max(0, listOffsetTop);
    syncFromExternal();
    return;
  }
  host.scrollTop = 0;
  listScrollOffset.value = 0;
}

/** 滚动容器在 padding 内的可视内容高度，以及真实 maxScrollTop */
function getScrollHostContentViewport(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const padTop = Number.parseFloat(cs.paddingTop) || 0;
  const padBottom = Number.parseFloat(cs.paddingBottom) || 0;
  const raw = el.clientHeight - padTop - padBottom;
  const contentH = Number.isFinite(raw) ? Math.max(1, raw) : 1;
  const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
  return { contentH, maxScroll };
}

function applyScrollTop(
  nextScrollTop: number,
  behavior: ScrollBehavior = "auto",
): Promise<void> {
  const el = getScrollHost();
  if (!el) return Promise.resolve();
  if (Math.abs(nextScrollTop - el.scrollTop) < 0.5) return Promise.resolve();

  if (behavior === "smooth") {
    cancelPendingSmoothScroll?.();

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      el.scrollTop = nextScrollTop;
      if (useExternalScroll.value) syncFromExternal();
      else listScrollOffset.value = nextScrollTop;
      cancelPendingSmoothScroll = null;
      return Promise.resolve();
    }

    const targetTop = nextScrollTop;
    const startTop = el.scrollTop;
    const dist = targetTop - startTop;
    const durationMs = Math.min(
      480,
      Math.max(160, Math.sqrt(Math.abs(dist)) * 14),
    );

    return new Promise<void>((resolve) => {
      let cancelled = false;
      let rafId = 0;
      const t0 = performance.now();

      const finish = (root: HTMLElement) => {
        root.scrollTop = targetTop;
        if (useExternalScroll.value) syncFromExternal();
        else listScrollOffset.value = targetTop;
        cancelPendingSmoothScroll = null;
        resolve();
      };

      const tick = (now: number) => {
        if (cancelled) return;
        const root = getScrollHost();
        if (!root) {
          cancelPendingSmoothScroll = null;
          resolve();
          return;
        }
        const t = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - (1 - t) * (1 - t);
        root.scrollTop = startTop + dist * eased;
        if (useExternalScroll.value) syncFromExternal();
        else listScrollOffset.value = root.scrollTop;
        if (t < 1 - 1e-6) {
          rafId = requestAnimationFrame(tick);
        } else {
          finish(root);
        }
      };

      cancelPendingSmoothScroll = () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        cancelPendingSmoothScroll = null;
        resolve();
      };

      rafId = requestAnimationFrame(tick);
    });
  }

  el.scrollTop = nextScrollTop;
  if (useExternalScroll.value) syncFromExternal();
  else listScrollOffset.value = nextScrollTop;
  return Promise.resolve();
}

/**
 * 将指定下标滚入视口。
 * - center：垂直居中
 * - auto：仅在必要时滚动
 * @returns 平滑滚动结束（或即时滚动完成）时 resolve 的 Promise
 */
function scrollToIndex(
  index: number,
  options?: {
    align?: "center" | "auto";
    behavior?: ScrollBehavior;
    force?: boolean;
  },
): Promise<void> {
  const el = getScrollHost();
  if (!el || props.itemCount <= 0) return Promise.resolve();
  const stride = props.rowStride;
  const n = props.itemCount;
  const idx = Math.max(0, Math.min(Math.floor(index), n - 1));
  const itemTopInList = idx * stride;
  const itemBottomInList = itemTopInList + stride;
  const padding = props.scrollPadding ?? 5;
  const align = options?.align ?? "auto";
  const behavior = options?.behavior ?? "auto";

  let listOffsetTop = 0;
  if (useExternalScroll.value) {
    const root = listRootEl.value;
    if (!root) return Promise.resolve();
    listOffsetTop = measureListOffsetInHost(el, root);
  }

  const itemTop = listOffsetTop + itemTopInList;
  const itemBottom = listOffsetTop + itemBottomInList;

  let nextScrollTop = el.scrollTop;
  const { contentH, maxScroll: domMaxScroll } = getScrollHostContentViewport(el);
  const expectedInner = useExternalScroll.value
    ? el.scrollHeight
    : n * stride;
  let maxScroll = domMaxScroll;
  if (options?.force && !useExternalScroll.value && el.scrollHeight + 4 < expectedInner) {
    maxScroll = Math.max(0, expectedInner - contentH);
  }

  if (align === "center") {
    let viewH = contentH;
    if (el.clientHeight <= 0) {
      viewH = Math.max(1, listViewportHeight.value);
    }
    nextScrollTop = itemTop + stride / 2 - viewH / 2;
    nextScrollTop = Math.max(0, Math.min(nextScrollTop, maxScroll));
  } else {
    const viewTop = el.scrollTop + padding;
    const viewBottom = el.scrollTop + contentH - padding;
    if (itemTop < viewTop) {
      nextScrollTop = itemTop - padding;
    } else if (itemBottom > viewBottom) {
      nextScrollTop = itemBottom - (contentH - padding);
    }
    nextScrollTop = Math.max(0, Math.min(nextScrollTop, maxScroll));
  }

  if (!options?.force && Math.abs(nextScrollTop - el.scrollTop) < 0.5) {
    return Promise.resolve();
  }

  return applyScrollTop(nextScrollTop, behavior);
}

watch(
  () => virtualWindow.value.indices,
  (indices) => {
    emit("visibleIndices", indices.slice());
  },
  { immediate: true },
);

defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollEl,
  syncFromExternal,
  /** 当前虚拟窗下标（含 overscan） */
  getVisibleIndices: () => virtualWindow.value.indices.slice(),
});
</script>

<template>
  <div
    ref="scrollEl"
    class="virtualList-scroll"
    :class="{ 'virtualList-scroll--external': useExternalScroll }"
    @scroll="onInternalScroll"
  >
    <div
      ref="listRootEl"
      class="virtualList-root"
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        class="virtualList-run"
        :style="{ transform: `translateY(${virtualWindow.offsetY}px)` }"
      >
        <div
          v-for="index in virtualWindow.indices"
          :key="resolveKey(index)"
          class="virtualList-row"
          :style="{ height: `${rowStride}px` }"
        >
          <slot :index="index" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtualList-scroll {
  overflow: auto;
  min-height: 0;
  flex: 1;
  width: 100%;
}

.virtualList-scroll--external {
  overflow: hidden;
  flex: none;
  min-height: 0;
}

.virtualList-root {
  position: relative;
  width: 100%;
}

.virtualList-run {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  will-change: transform;
}

.virtualList-row {
  flex-shrink: 0;
  box-sizing: border-box;
}

.virtualList-row > :deep(*) {
  height: 100%;
  width: 100%;
  box-sizing: border-box;
}
</style>
