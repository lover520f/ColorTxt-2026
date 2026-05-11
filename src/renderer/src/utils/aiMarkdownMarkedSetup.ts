/**
 * AI 助手 Markdown：marked + KaTeX（`$…$` 行内、`$$…$$` 块级；块级也可独占行写法）。
 * 统一从此导出 `marked`，避免别处直接 `import { marked } from "marked"` 漏挂扩展。
 */
import { marked } from "marked";
import markedKatex from "marked-katex-extension";

marked.use(
  markedKatex({
    throwOnError: false,
  }),
);

export { marked };
