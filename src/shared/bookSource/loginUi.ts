export type LoginUiRow = {
  name: string;
  type: "text" | "password" | "button" | string;
  action?: string;
};

/** 解析书源 loginUi（部分源使用 JS 对象字面量而非严格 JSON） */
export function parseLoginUi(raw?: string | LoginUiRow[] | null): LoginUiRow[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  const s = raw.trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as LoginUiRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      const normalized = s.replace(
        /(\{|,)\s*([a-zA-Z_][\w]*)\s*:/g,
        '$1"$2":',
      );
      const parsed = JSON.parse(normalized) as LoginUiRow[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export function collectLoginFormData(
  rows: LoginUiRow[],
  form: Record<string, string>,
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const row of rows) {
    if (row.type === "text" || row.type === "password") {
      data[row.name] = form[row.name] ?? "";
    }
  }
  return data;
}
