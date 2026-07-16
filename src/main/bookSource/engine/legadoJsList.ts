/** Legado/Rhino：java.getStringList / java.getElements 返回可 .toArray() 的列表 */
export type LegadoJsList<T = unknown> = {
  toArray(): T[];
  isEmpty(): boolean;
  size(): number;
  get(index: number): T | undefined;
  length: number;
  [Symbol.iterator](): Iterator<T>;
};

export function legadoJsList<T>(items: readonly T[]): LegadoJsList<T> {
  const arr = [...items];
  return {
    toArray: () => [...arr],
    isEmpty: () => arr.length === 0,
    size: () => arr.length,
    get: (index: number) => arr[index],
    length: arr.length,
    [Symbol.iterator]: () => arr[Symbol.iterator](),
  };
}

function isAsyncFunction(fn: unknown): boolean {
  return (
    typeof fn === "function" &&
    (fn as { constructor?: { name?: string } }).constructor?.name ===
      "AsyncFunction"
  );
}

/**
 * 给原生数组挂上 Legado `List.toArray()` 等 API（保持 `Array.isArray`）。
 * 规则链 JSONPath → `<js>` 时 result 常为数组，部分书源会调 `result.toArray()`。
 *
 * 另：`map(async …)` 改为串行 await（对齐 Rhino 同步 map）。
 * Node 把 `await java.ajax` 升成 async 后若仍用原生 map，会一次打出全部请求
 *（如搜索 list 对每项再 ajax 详情 → 限流 / TimeoutError）。
 */
export function ensureLegadoListApi<T = unknown>(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const arr = value as T[] &
    Partial<LegadoJsList<T>> & {
      __legadoSequentialAsyncMap?: boolean;
      map: typeof Array.prototype.map;
    };
  if (typeof arr.toArray !== "function") {
    arr.toArray = () => [...arr];
    arr.isEmpty = () => arr.length === 0;
    arr.size = () => arr.length;
    arr.get = (index: number) => arr[index];
  }
  if (!arr.__legadoSequentialAsyncMap) {
    Object.defineProperty(arr, "map", {
      configurable: true,
      writable: true,
      enumerable: false,
      value(callback: (item: T, index: number, array: T[]) => unknown, thisArg?: unknown) {
        if (!isAsyncFunction(callback)) {
          return Array.prototype.map.call(this, callback as never, thisArg);
        }
        const list = this as T[];
        return (async () => {
          const out: unknown[] = [];
          for (let i = 0; i < list.length; i++) {
            out.push(
              await (callback as (item: T, index: number, array: T[]) => Promise<unknown>).call(
                thisArg,
                list[i]!,
                i,
                list,
              ),
            );
          }
          return out;
        })();
      },
    });
    arr.__legadoSequentialAsyncMap = true;
  }
  return arr;
}

export async function legadoJsListFrom<T>(
  value: unknown,
): Promise<LegadoJsList<T>> {
  if (value && typeof value === "object" && "toArray" in value) {
    return value as LegadoJsList<T>;
  }
  if (Array.isArray(value)) return legadoJsList(value as T[]);
  if (value == null || value === "") return legadoJsList<T>([]);
  return legadoJsList([value as T]);
}
