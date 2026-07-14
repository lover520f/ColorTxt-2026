import { appConfirm } from "../../services/appDialog";
import { appToast } from "../../services/appToast";

/** 确认后清除单本书离线章节缓存；成功返回 true */
export async function confirmClearBookChapterCache(opts: {
  name: string;
  bookUrl: string;
  cacheDir?: string;
}): Promise<boolean> {
  const bookUrl = opts.bookUrl.trim();
  if (!bookUrl) {
    appToast("书籍 URL 为空", { kind: "warning" });
    return false;
  }
  const ok = await appConfirm("是否清除本书的离线章节缓存？", "清除缓存");
  if (!ok) return false;
  try {
    const res = await window.colorTxt.bookSourceClearChapterCache({
      name: opts.name.trim(),
      bookUrl,
      cacheDir: opts.cacheDir?.trim() || undefined,
    });
    if (!res.ok) {
      appToast(res.message || "清除缓存失败", { kind: "warning" });
      return false;
    }
    appToast("已清除本书缓存", { kind: "success", duration: 1200 });
    return true;
  } catch {
    appToast("清除缓存失败", { kind: "warning" });
    return false;
  }
}
