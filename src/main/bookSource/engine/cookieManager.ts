import { CookieJar } from "tough-cookie";
import {
  getCookieJar,
  saveCookieJar,
} from "../store/bookSourceStore";

const jarByDomain = new Map<string, CookieJar>();

export function getDomainFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname;
  } catch {
    return url;
  }
}

function loadJar(domain: string): CookieJar {
  let jar = jarByDomain.get(domain);
  if (!jar) {
    jar = new CookieJar();
    const stored = getCookieJar(domain);
    for (const [name, value] of Object.entries(stored)) {
      try {
        jar.setCookieSync(`${name}=${value}`, `https://${domain}/`);
      } catch {
        /* ignore invalid */
      }
    }
    jarByDomain.set(domain, jar);
  }
  return jar;
}

export function persistJar(domain: string): void {
  const jar = jarByDomain.get(domain);
  if (!jar) return;
  const cookies = jar.getCookiesSync(`https://${domain}/`);
  const map: Record<string, string> = {};
  for (const c of cookies) {
    map[c.key] = c.value;
  }
  saveCookieJar(domain, map);
}

export function cookieHeaderForUrl(url: string): string {
  const domain = getDomainFromUrl(url);
  const jar = loadJar(domain);
  try {
    return jar.getCookieStringSync(url) || "";
  } catch {
    return "";
  }
}

export function setCookieFromResponse(url: string, setCookie: string | string[]): void {
  const domain = getDomainFromUrl(url);
  const jar = loadJar(domain);
  const headers = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const h of headers) {
    if (!h) continue;
    try {
      jar.setCookieSync(h, url);
    } catch {
      /* ignore */
    }
  }
  persistJar(domain);
}

export function getCookieKey(domain: string, name: string): string | null {
  const jar = loadJar(domain);
  const cookies = jar.getCookiesSync(`https://${domain}/`);
  const found = cookies.find((c) => c.key === name);
  return found?.value ?? null;
}

function parseCookiePairs(cookie: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookie?.trim()) return map;
  for (const segment of cookie.split(";")) {
    const part = segment.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    if (value || value === "null") map[name] = value;
  }
  return map;
}

function mapToCookieHeader(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function resolveCookieUrl(url: string): string {
  return url.includes("://") ? url : `https://${url}`;
}

/** Legado CookieStore.setCookie：按 url 二级域名保存整段 Cookie */
export function setCookieForUrl(url: string, cookie?: string | null): void {
  const absUrl = resolveCookieUrl(url);
  const domain = getDomainFromUrl(absUrl);
  if (!cookie?.trim()) {
    removeDomainCookies(domain);
    return;
  }
  const jar = new CookieJar();
  const pairs = parseCookiePairs(cookie);
  if (Object.keys(pairs).length === 0) {
    try {
      jar.setCookieSync(cookie.trim(), absUrl);
    } catch {
      /* ignore invalid Set-Cookie */
    }
  } else {
    for (const [name, value] of Object.entries(pairs)) {
      try {
        jar.setCookieSync(`${name}=${value}`, absUrl);
      } catch {
        /* ignore invalid cookie */
      }
    }
  }
  jarByDomain.set(domain, jar);
  persistJar(domain);
}

/** Legado CookieStore.replaceCookie：与已有 Cookie 合并后保存 */
export function replaceCookieForUrl(url: string, cookie: string): void {
  if (!cookie?.trim()) return;
  const absUrl = resolveCookieUrl(url);
  const merged = {
    ...parseCookiePairs(cookieHeaderForUrl(absUrl)),
    ...parseCookiePairs(cookie),
  };
  setCookieForUrl(absUrl, mapToCookieHeader(merged));
}

export function cookieStringToMap(cookie: string): Record<string, string> {
  return parseCookiePairs(cookie);
}

export function mapToCookieString(
  cookieMap: Record<string, string> | null | undefined,
): string {
  if (!cookieMap || !Object.keys(cookieMap).length) return "";
  return mapToCookieHeader(cookieMap);
}

export function removeDomainCookies(domain: string): void {
  jarByDomain.delete(domain);
  saveCookieJar(domain, {});
}
