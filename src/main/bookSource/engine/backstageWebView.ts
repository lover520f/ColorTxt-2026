import { BrowserWindow } from "electron";
import type { BookSourceRecord } from "@shared/bookSource/types";
import {
  headersToLoadUrlExtraHeaders,
  resolveSourceRequestHeaders,
} from "./sourceRequestHeaders";
import { getWebViewUserAgent } from "./bookSourceUserAgent";
import {
  getDomainFromUrl,
  setCookieFromResponse,
} from "./cookieManager";
import type { JsExtensionHost } from "./jsExtensions";

export type BackstageWebViewOptions = {
  html?: string | null;
  url?: string | null;
  js?: string | null;
  source?: BookSourceRecord;
  host?: JsExtensionHost;
  headers?: Record<string, string>;
  delayMs?: number;
  timeoutMs?: number;
  injectResult?: unknown;
  overrideUrlRegex?: string | null;
  cacheFirst?: boolean;
};

const WEBVIEW_CONTEXT = `
var result = typeof window.result !== 'undefined' ? window.result : '';
var src = document.documentElement ? document.documentElement.outerHTML : '';
var baseUrl = location.href;
`;

export function stripWebJsRule(rule: string): string {
  return rule.replace(/^@webjs:\s*/i, "").trim();
}

async function persistWebViewCookies(
  webContents: Electron.WebContents,
  pageUrl: string,
): Promise<void> {
  const cookies = await webContents.session.cookies.get({});
  for (const c of cookies) {
    const domain = c.domain?.replace(/^\./, "") ?? getDomainFromUrl(pageUrl);
    setCookieFromResponse(
      `https://${domain}/`,
      `${c.name}=${c.value}; Domain=${c.domain ?? domain}; Path=${c.path ?? "/"}`,
    );
  }
}

export async function runBackstageWebView(
  opts: BackstageWebViewOptions,
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const pageUrl = (opts.url?.trim() || "about:blank").split(",")[0]!.trim();
  const html = opts.html?.trim() ?? "";
  const userScript = opts.js?.trim() || "document.documentElement.outerHTML";
  const delayMs =
    opts.delayMs ?? (opts.js?.trim() ? 100 : 900);

  let headers = { ...(opts.headers ?? {}) };
  if (opts.source) {
    headers = {
      ...(await resolveSourceRequestHeaders(opts.source, {
        baseUrl: pageUrl.startsWith("http") ? pageUrl : opts.source.bookSourceUrl,
        host: opts.host,
        logs: opts.host?.logs,
      })),
      ...headers,
    };
  }
  const userAgent =
    headers["User-Agent"] ??
    headers["user-agent"] ??
    getWebViewUserAgent();

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
    const wc = win.webContents;
    wc.setUserAgent(userAgent);

    if (opts.overrideUrlRegex) {
      const re = new RegExp(opts.overrideUrlRegex);
      return await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("webView 跳转匹配超时")),
          timeoutMs,
        );
        const onNav = (_event: Electron.Event, url: string) => {
          if (!re.test(url)) return;
          clearTimeout(timer);
          cleanup();
          resolve(url);
        };
        const cleanup = () => {
          wc.removeListener("will-navigate", onNav);
          wc.removeListener("did-navigate", onNav);
        };
        wc.on("will-navigate", onNav);
        wc.on("did-navigate", onNav);
        void loadWebViewContent(wc, pageUrl, html, headers).catch((err) => {
          clearTimeout(timer);
          cleanup();
          reject(err);
        });
      });
    }

    await loadWebViewContent(wc, pageUrl, html, headers, timeoutMs);

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    if (opts.injectResult != null) {
      const json = JSON.stringify(opts.injectResult);
      await wc.executeJavaScript(`window.result = ${json};`);
    }

    const wrappedScript = `
      (async function() {
        ${WEBVIEW_CONTEXT}
        try {
          const __out = await (async function() {
            ${userScript}
          })();
          if (__out === undefined || __out === null) return "";
          if (typeof __out === "object") return JSON.stringify(__out);
          return String(__out);
        } catch (e) {
          return "";
        }
      })()
    `;

    let last = "";
    for (let retry = 0; retry < 30; retry++) {
      const raw = await wc.executeJavaScript(wrappedScript, true);
      last = typeof raw === "string" ? raw : String(raw ?? "");
      if (last && last !== "null" && last !== "undefined") break;
      await new Promise((r) =>
        setTimeout(r, Math.min(200 * (retry + 1), 1000)),
      );
    }

    if (pageUrl.startsWith("http")) {
      await persistWebViewCookies(wc, pageUrl);
    }
    return last;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function loadWebViewContent(
  wc: Electron.WebContents,
  pageUrl: string,
  html: string,
  headers: Record<string, string>,
  timeoutMs = 60_000,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("webView 页面加载超时")),
      timeoutMs,
    );
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const fail = (_: unknown, code: number, desc: string) => {
      if (code === -3) return;
      clearTimeout(timer);
      reject(new Error(`webView 加载失败: ${desc || code}`));
    };
    wc.once("did-finish-load", done);
    wc.once("did-fail-load", fail);

    if (html) {
      void wc
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, {
          baseURLForDataURL: pageUrl.startsWith("http") ? pageUrl : undefined,
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      return;
    }
    if (pageUrl.startsWith("http")) {
      const extraHeaders = headersToLoadUrlExtraHeaders(
        Object.fromEntries(
          Object.entries(headers).filter(([k]) => !/^user-agent$/i.test(k)),
        ),
      );
      void wc
        .loadURL(pageUrl, extraHeaders ? { extraHeaders } : undefined)
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      return;
    }
    void wc.loadURL("about:blank").catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
