/** 键盘事件是否起源于阅读侧栏（活动栏 + 面板） */
export function keyboardEventFromReaderSidebar(ev: KeyboardEvent): boolean {
  for (const n of ev.composedPath()) {
    if (
      n instanceof HTMLElement &&
      n.hasAttribute("data-reader-sidebar-root")
    ) {
      return true;
    }
  }
  return false;
}
