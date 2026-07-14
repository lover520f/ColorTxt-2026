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
