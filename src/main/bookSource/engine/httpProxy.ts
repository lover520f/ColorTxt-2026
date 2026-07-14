import { ProxyAgent, type Dispatcher } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";

export type ParsedProxy = {
  uri: string;
  type: "http" | "socks";
};

const PROXY_RE =
  /^(http|socks4|socks5):\/\/([^:@/]+):(\d{2,5})(?:@([^@]*)@([^@]*))?$/i;

/** Legado getProxyClient 代理字符串解析 */
export function parseLegadoProxy(raw: string): ParsedProxy | null {
  const text = raw.trim();
  if (!text) return null;
  const m = PROXY_RE.exec(text);
  if (!m) return null;
  const scheme = m[1]!.toLowerCase();
  const host = m[2]!;
  const port = m[3]!;
  const username = m[4] ?? "";
  const password = m[5] ?? "";
  const auth =
    username !== "" || password !== ""
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : "";
  if (scheme === "http") {
    return { type: "http", uri: `http://${auth}${host}:${port}` };
  }
  const socksScheme = scheme === "socks4" ? "socks4" : "socks5";
  return { type: "socks", uri: `${socksScheme}://${auth}${host}:${port}` };
}

const dispatcherCache = new Map<string, Dispatcher>();

export function getProxyDispatcher(proxy?: string | null): Dispatcher | undefined {
  const parsed = parseLegadoProxy(String(proxy ?? "").trim());
  if (!parsed) return undefined;
  const cached = dispatcherCache.get(parsed.uri);
  if (cached) return cached;
  const dispatcher =
    parsed.type === "http"
      ? new ProxyAgent(parsed.uri)
      : (new SocksProxyAgent(parsed.uri) as unknown as Dispatcher);
  dispatcherCache.set(parsed.uri, dispatcher);
  return dispatcher;
}

/** 从请求头中提取 proxy 并移除，对齐 Legado AnalyzeUrl headerMap */
export function extractProxyFromHeaders(
  headers: Record<string, string>,
): { headers: Record<string, string>; proxy?: string } {
  const out = { ...headers };
  const direct = out.proxy ?? out.Proxy;
  if (direct?.trim()) {
    delete out.proxy;
    delete out.Proxy;
    return { headers: out, proxy: direct.trim() };
  }
  return { headers: out };
}
