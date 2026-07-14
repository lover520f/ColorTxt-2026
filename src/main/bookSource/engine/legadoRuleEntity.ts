export type LegadoVariableSync = {
  putVariable(key: string, value: string): void;
  getVariable(key: string): string;
};

function normalizeVariable(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k === "get" || typeof v === "function") continue;
      out[k] = String(v ?? "");
    }
    return out;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return normalizeVariable(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }
  return {};
}

function attachVariableMethods(
  target: Record<string, unknown>,
  variable: Record<string, string>,
  sync?: LegadoVariableSync,
): Record<string, unknown> {
  return {
    ...target,
    get(key: string): string {
      if (key === "bookName") return String(target.name ?? "");
      if (key === "title") return String(target.title ?? "");
      if (key in variable) return variable[key] ?? "";
      const direct = target[key];
      return direct == null ? "" : String(direct);
    },
    getVariable(key?: string): string {
      if (key == null || key === "") {
        return variable.custom ?? "";
      }
      if (key === "custom") return variable.custom ?? "";
      const fromVar = variable[key];
      if (fromVar) return fromVar;
      return sync?.getVariable(key) ?? "";
    },
    putVariable(key: string, value?: unknown): string {
      const s = String(value ?? "");
      variable[key] = s;
      target.variable = variable;
      sync?.putVariable(key, s);
      return s;
    },
    putCustomVariable(value: unknown): string {
      const s = String(value ?? "");
      variable.custom = s;
      target.variable = variable;
      sync?.putVariable("custom", s);
      return s;
    },
  };
}

export function wrapLegadoBookForJs(
  book: Record<string, unknown> | undefined | null,
  sync?: LegadoVariableSync,
): Record<string, unknown> {
  if (!book || typeof book !== "object" || Array.isArray(book)) {
    const empty: Record<string, unknown> = { variable: {} };
    return attachVariableMethods(empty, {}, sync);
  }
  const base = book as Record<string, unknown> & {
    get?: unknown;
    putVariable?: unknown;
    putCustomVariable?: unknown;
    getVariable?: unknown;
  };
  if (
    typeof base.putCustomVariable === "function" &&
    typeof base.putVariable === "function" &&
    typeof base.getVariable === "function"
  ) {
    return base;
  }
  const variable = normalizeVariable(base.variable);
  base.variable = variable;
  return attachVariableMethods(base, variable, sync);
}

export function wrapLegadoChapterForJs(
  chapter: Record<string, unknown> | undefined | null,
  sync?: LegadoVariableSync,
): Record<string, unknown> {
  if (!chapter || typeof chapter !== "object" || Array.isArray(chapter)) {
    const empty: Record<string, unknown> = { variable: {} };
    return attachVariableMethods(empty, {}, sync);
  }
  const base = chapter as Record<string, unknown> & {
    putVariable?: unknown;
    getVariable?: unknown;
  };
  if (typeof base.putVariable === "function" && typeof base.getVariable === "function") {
    return base;
  }
  const variable = normalizeVariable(base.variable);
  base.variable = variable;
  return attachVariableMethods(base, variable, sync);
}
