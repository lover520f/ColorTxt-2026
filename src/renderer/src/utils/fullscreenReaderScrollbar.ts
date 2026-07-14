import type ReaderMain from "../components/ReaderMain.vue";
import type { Ref } from "vue";

/** 与 Monaco `.invisible.fade` 淡出时长一致 */
export const FULLSCREEN_READER_SCROLLBAR_HIDE_MS = 800;

export function queryReaderVerticalScrollbar(
  readerRef: Ref<InstanceType<typeof ReaderMain> | null>,
): HTMLElement | null {
  const root = readerRef.value?.$el;
  if (!(root instanceof HTMLElement)) return null;
  const el = root.querySelector(
    ".monaco-editor .monaco-scrollable-element > .scrollbar.vertical",
  );
  return el instanceof HTMLElement ? el : null;
}

export function setReaderVerticalScrollbarRevealed(
  readerRef: Ref<InstanceType<typeof ReaderMain> | null>,
  revealed: boolean,
): void {
  const sb = queryReaderVerticalScrollbar(readerRef);
  if (!sb) return;
  if (revealed) {
    sb.classList.remove("invisible", "fade");
    sb.classList.add("visible");
    return;
  }
  sb.classList.remove("visible");
  sb.classList.add("invisible", "fade");
}
