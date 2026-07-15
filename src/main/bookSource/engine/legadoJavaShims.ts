import { createDecipheriv, createHash, createHmac } from "node:crypto";
import { createOrgPackage } from "./legadoJsoupShim";

export { createOrgPackage } from "./legadoJsoupShim";

function isByteLike(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    Buffer.isBuffer(value) ||
    (Array.isArray(value) && value.length > 0 && typeof value[0] === "number")
  );
}

function coerceJavaString(input: unknown): string {
  if (input && typeof input === "object") {
    const obj = input as { toString?: () => string };
    if (typeof obj.toString === "function") {
      return obj.toString();
    }
  }
  return String(input ?? "");
}

export { coerceJavaString };

function toBuffer(value: unknown): Buffer {
  return Buffer.from(value as Uint8Array);
}

/** Legado Packages.* — 深代理；Packages.org 提供 jsoup 等真实包 */
export function createPackagesStub(): Record<string, unknown> {
  const org = createOrgPackage();
  const proxy = (): object =>
    new Proxy(
      function () {
        /* noop ctor */
      },
      {
        get(_t, prop) {
          if (prop === "then") return undefined;
          return proxy();
        },
        apply: () => proxy(),
        construct: () => proxy(),
      },
    );
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        if (prop === "org") return org;
        return proxy();
      },
    },
  );
}

function createJavaLikeString(str: string): unknown {
  const boxed = Object(str);
  return new Proxy(boxed, {
    get(target, prop, receiver) {
      if (prop === "getBytes") {
        return (_charset?: string) => Buffer.from(str, "utf8");
      }
      if (prop === "toJSON") {
        return () => str;
      }
      if (prop === Symbol.toPrimitive) {
        return (hint: string) => (hint === "number" ? Number(str) : str);
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === "function") {
        return (val as (...args: unknown[]) => unknown).bind(target);
      }
      return val;
    },
  });
}

function createJavaLangShims(): Record<string, unknown> {
  function stringValue(value?: unknown): string {
    if (isByteLike(value)) {
      return toBuffer(value).toString("utf8");
    }
    return value === undefined ? "" : String(value);
  }

  function javaString(value?: unknown): unknown {
    return createJavaLikeString(stringValue(value));
  }
  return { String: javaString };
}

function createJavaUtilShims(): Record<string, unknown> {
  return {
    Base64: {
      getDecoder() {
        return {
          decode(input: unknown) {
            return Buffer.from(coerceJavaString(input), "base64");
          },
        };
      },
      getEncoder() {
        return {
          encode(input: unknown) {
            return Buffer.from(toBuffer(input)).toString("base64");
          },
        };
      },
    },
    Arrays: {
      copyOfRange(arr: unknown, from: number, to: number) {
        return toBuffer(arr).subarray(from, to);
      },
    },
  };
}

function normalizeMacAlgorithm(algorithm: string): string {
  const u = algorithm.trim();
  const m = u.match(/^Hmac?(MD5|SHA1|SHA256|SHA384|SHA512)$/i);
  if (m) {
    const inner = m[1]!.toUpperCase();
    if (inner === "MD5") return "md5";
    return inner.toLowerCase();
  }
  return u.toLowerCase().replace(/^hmac/, "");
}

function createJavaxCryptoShims(): Record<string, unknown> {
  return {
    Mac: {
      getInstance(algorithm: string) {
        const nodeAlgo = normalizeMacAlgorithm(algorithm);
        let keyBuf = Buffer.alloc(0);
        return {
          init(keySpec: { key?: Buffer } | unknown) {
            if (keySpec && typeof keySpec === "object" && "key" in keySpec) {
              keyBuf = Buffer.from((keySpec as { key: Buffer }).key);
            } else {
              keyBuf = Buffer.from(String(keySpec ?? ""));
            }
          },
          doFinal(data: unknown) {
            const input = isByteLike(data)
              ? toBuffer(data)
              : Buffer.from(String(data ?? ""), "utf8");
            return createHmac(nodeAlgo, keyBuf).update(input).digest();
          },
        };
      },
    },
    SecretKeySpec(key: unknown, _algo: string) {
      const buf = isByteLike(key) ? toBuffer(key) : Buffer.from(String(key ?? ""), "utf8");
      return { key: buf };
    },
    IvParameterSpec(iv: Buffer) {
      return { iv: Buffer.from(iv) };
    },
    Cipher: {
      getInstance(transformation: string) {
        const [algoRaw, modeRaw] = transformation.split("/");
        const algo = (algoRaw ?? "AES").toLowerCase();
        const mode = (modeRaw ?? "CBC").toLowerCase();
        let decipher: ReturnType<typeof createDecipheriv> | null = null;
        return {
          init(opmode: number, key: { key: Buffer }, iv: { iv: Buffer }) {
            if (opmode !== 2) {
              throw new Error(`Cipher opmode ${opmode} not supported`);
            }
            const bits = key.key.length * 8;
            const nodeAlgo = `${algo}-${bits}-${mode}`;
            decipher = createDecipheriv(nodeAlgo, key.key, iv.iv);
          },
          doFinal(data: Buffer) {
            if (!decipher) throw new Error("Cipher not initialized");
            return Buffer.concat([decipher.update(data), decipher.final()]);
          },
        };
      },
    },
  };
}

/** Rhino JavaImporter — 注入 Hutool/OkHttp 与 java.lang / javax.crypto 兼容层 */
export function createJavaImporter(log: (msg: string) => void): Record<string, unknown> {
  const bag: Record<string, unknown> = {};
  bag.importPackage = (..._pkg: unknown[]) => {
    Object.assign(
      bag,
      createHutoolShims(),
      createOkHttpShims(log),
      createJavaLangShims(),
      createJavaUtilShims(),
      createJavaxCryptoShims(),
    );
  };
  return bag;
}

function createHutoolShims(): Record<string, unknown> {
  return {
    DigestUtil: {
      md5Hex: (str: unknown) =>
        createHash("md5").update(String(str)).digest("hex"),
    },
    StrUtil: {
      reverse: (str: unknown) => [...String(str)].reverse().join(""),
    },
    Base64: {
      decode: (str: unknown) => Buffer.from(String(str), "base64").toString("utf8"),
    },
    ZipUtil: {
      gzip: (data: unknown) => String(data),
    },
  };
}

function createOkHttpShims(log: (msg: string) => void): Record<string, unknown> {
  class Builder {
    private requestUrl = "";
    private headers: Record<string, string> = {};
    private body: string | null = null;
    url(u: string) {
      this.requestUrl = u;
      return this;
    }
    post(b: unknown) {
      this.body = String(b ?? "");
      return this;
    }
    get() {
      return this;
    }
    addHeader(k: string, v: string) {
      this.headers[k] = v;
      return this;
    }
    build() {
      return { url: this.requestUrl, headers: this.headers, body: this.body };
    }
  }
  return {
    MediaType: { parse: () => "application/json" },
    RequestBody: { create: (body: unknown) => String(body ?? "") },
    Request: { Builder },
    OkHttpClient: class {
      newCall(req: { url: string; headers: Record<string, string>; body: string | null }) {
        return {
          execute: () => ({
            body: () => ({
              string: () => {
                log(`jsLib okhttp POST ${req.url}`);
                return JSON.stringify({ data: "" });
              },
            }),
          }),
        };
      }
    },
  };
}
