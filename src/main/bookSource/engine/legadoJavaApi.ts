import { createHmac, randomUUID as nodeRandomUUID } from "node:crypto";
import iconv from "iconv-lite";

import { convertTextOpenCc } from "../../textConvertOpenCc";
import { createSymmetricCrypto } from "./legadoCrypto";

export function legadoJsonValueToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String(obj[k] ?? ""))
        .join("");
    }
    if (keys.length === 0) return "";
  }
  return String(value);
}

function normalizeHmacAlgorithm(algorithm: string): string {
  const u = algorithm.trim();
  const m = u.match(/^Hmac?(MD5|SHA1|SHA256|SHA384|SHA512)$/i);
  if (m) {
    const inner = m[1]!.toUpperCase();
    if (inner === "MD5") return "md5";
    return inner.toLowerCase();
  }
  return u.toLowerCase().replace(/^hmac/, "");
}

/** Legado java.encodeURI(str) / java.encodeURI(str, charset) */
export function encodeLegadoUri(str: unknown, charset?: unknown): string {
  const text = String(str ?? "");
  const cs = charset != null ? String(charset).trim().toLowerCase() : "utf-8";
  if (!cs || cs === "utf-8" || cs === "utf8") {
    return encodeURIComponent(text);
  }
  const buf = iconv.encode(text, cs);
  return Array.from(buf)
    .map((b) => `%${b.toString(16).padStart(2, "0").toUpperCase()}`)
    .join("");
}

/** Legado java.HMacHex(data, algorithm, key) */
export function hMacHex(data: unknown, algorithm: unknown, key: unknown): string {
  const algo = normalizeHmacAlgorithm(String(algorithm ?? "HmacSHA256"));
  try {
    return createHmac(algo, String(key ?? ""))
      .update(String(data ?? ""), "utf8")
      .digest("hex");
  } catch {
    return "";
  }
}

/** Legado java.HMacBase64(data, algorithm, key) */
export function hMacBase64(data: unknown, algorithm: unknown, key: unknown): string {
  const algo = normalizeHmacAlgorithm(String(algorithm ?? "HmacSHA256"));
  try {
    return createHmac(algo, String(key ?? ""))
      .update(String(data ?? ""), "utf8")
      .digest("base64");
  } catch {
    return "";
  }
}

/** Legado java.desEncodeToBase64String */
export function desEncodeToBase64String(
  data: unknown,
  key: unknown,
  transformation: unknown,
  iv: unknown,
): string {
  return createSymmetricCrypto(
    transformation ?? "DES/ECB/PKCS5Padding",
    key,
    iv,
  ).encryptBase64(String(data ?? ""));
}

/** Legado java.t2s / java.s2t */
export function legadoT2s(text: unknown): string {
  const s = String(text ?? "");
  if (!s) return s;
  try {
    return convertTextOpenCc(s, "t2s");
  } catch {
    return s;
  }
}

export function legadoS2t(text: unknown): string {
  const s = String(text ?? "");
  if (!s) return s;
  try {
    return convertTextOpenCc(s, "s2twp");
  } catch {
    return s;
  }
}

/** Legado java.randomUUID() */
export function legadoRandomUUID(): string {
  return nodeRandomUUID();
}

/** Legado java.timeFormat(time) — AppConst.dateFormat */
export function timeFormat(time: unknown): string {
  const ts = Number(time);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Legado java.timeFormatUTC(time, format, offsetHours) */
export function timeFormatUtc(
  time: unknown,
  format: unknown,
  offsetHours: unknown,
): string {
  const ts = Number(time);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const sh = Number(offsetHours) || 0;
  const d = new Date(ts + sh * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const tokens: Array<[string, string]> = [
    ["yyyy", String(d.getUTCFullYear())],
    ["MM", pad(d.getUTCMonth() + 1)],
    ["dd", pad(d.getUTCDate())],
    ["HH", pad(d.getUTCHours())],
    ["mm", pad(d.getUTCMinutes())],
    ["ss", pad(d.getUTCSeconds())],
  ];
  let out = String(format ?? "yyyy-MM-dd HH:mm:ss");
  for (const [token, value] of tokens) {
    out = out.replaceAll(token, value);
  }
  return out;
}
