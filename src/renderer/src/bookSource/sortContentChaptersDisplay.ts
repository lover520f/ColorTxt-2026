/**
 * 目录展示排序：`getChapterList` 默认 reverse，数组为「最新在前」。
 * `newestFirst === true` 保持 API 顺序；否则反转为正序阅读（旧→新）。
 */
export function sortContentChaptersDisplay<T>(
  contentChapters: T[],
  newestFirst: boolean,
): T[] {
  return newestFirst ? contentChapters : [...contentChapters].reverse();
}
