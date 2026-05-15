import type { CustomSelectItem } from "../components/AppCustomSelect.vue";
import {
  EDGE_TTS_VOICES,
  findEdgeTtsVoice,
  type EdgeTtsVoice,
} from "../constants/voiceReadEdgeTts";
import {
  DASHSCOPE_TTS_VOICES,
  type VoiceReadEngineId,
} from "../constants/voiceRead";

export type VoiceSelectOption = { id: string; label: string };

export type VoiceOptionGroup = readonly [
  locale: string,
  options: readonly VoiceSelectOption[],
];

const LOCALE_LABEL_OVERRIDES: Record<string, string> = {
  und: "未指定语言",
  "zh-CN": "中文（简体，中国）",
  "zh-HK": "中文（繁体，香港）",
  "zh-TW": "中文（繁体，台湾）",
  "en-AU": "英语（澳大利亚）",
  "en-CA": "英语（加拿大）",
  "en-GB": "英语（英国）",
  "en-IN": "英语（印度）",
  "en-US": "英语（美国）",
};

function normalizeLocaleCode(locale: string): string {
  const trimmed = locale.trim().replace(/_/g, "-");
  if (!trimmed) return "und";
  const [language, ...rest] = trimmed.split("-");
  if (!rest.length) return language.toLowerCase();
  return [
    language.toLowerCase(),
    ...rest.map((part) =>
      part.length === 4
        ? `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
        : part.toUpperCase(),
    ),
  ].join("-");
}

function resolveDisplayLocale(): string {
  try {
    const runtimeLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (runtimeLocale) return normalizeLocaleCode(runtimeLocale);
  } catch {
    // fall through
  }
  return "zh-CN";
}

/** 语种分组标题（固定中文 UI） */
export function getLocaleDisplayLabel(locale: string): string {
  const normalizedLocale = normalizeLocaleCode(locale || "und");
  const override = LOCALE_LABEL_OVERRIDES[normalizedLocale];
  if (override) return override;

  const resolvedDisplayLocale = resolveDisplayLocale();
  try {
    const [language, maybeScriptOrRegion, maybeRegion] =
      normalizedLocale.split("-");
    const languageNames = new Intl.DisplayNames([resolvedDisplayLocale, "en"], {
      type: "language",
    });
    const regionNames = new Intl.DisplayNames([resolvedDisplayLocale, "en"], {
      type: "region",
    });
    const scriptNames = new Intl.DisplayNames([resolvedDisplayLocale, "en"], {
      type: "script",
    });

    const languageLabel = languageNames.of(language);
    const extras: string[] = [];

    if (maybeScriptOrRegion) {
      if (maybeScriptOrRegion.length === 4) {
        const scriptLabel = scriptNames.of(maybeScriptOrRegion);
        if (scriptLabel) extras.push(scriptLabel);
        if (maybeRegion) {
          const regionLabel = regionNames.of(maybeRegion);
          if (regionLabel) extras.push(regionLabel);
        }
      } else {
        const regionLabel = regionNames.of(maybeScriptOrRegion);
        if (regionLabel) extras.push(regionLabel);
      }
    }

    if (languageLabel && extras.length > 0) {
      return `${languageLabel}（${extras.join("，")}）`;
    }
    if (languageLabel) return languageLabel;
  } catch {
    // fall through
  }

  return normalizedLocale;
}

export function compareVoiceLanguage(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const aZh = aLower.startsWith("zh") ? -2 : 0;
  const bZh = bLower.startsWith("zh") ? -2 : 0;
  const aEn = aLower.startsWith("en") ? -1 : 0;
  const bEn = bLower.startsWith("en") ? -1 : 0;
  return aZh - bZh || aEn - bEn || a.localeCompare(b);
}

export function groupEdgeTtsVoices(
  voices: readonly EdgeTtsVoice[] = EDGE_TTS_VOICES,
): VoiceOptionGroup[] {
  const grouped = new Map<string, EdgeTtsVoice[]>();
  for (const voice of voices) {
    const bucket = grouped.get(voice.lang) ?? [];
    bucket.push(voice);
    grouped.set(voice.lang, bucket);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => compareVoiceLanguage(a, b))
    .map(
      ([lang, items]) =>
        [
          lang,
          [...items]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((v) => ({ id: v.id, label: v.name })),
        ] as const,
    );
}

export type SystemVoiceOption = {
  id: string;
  label: string;
  lang: string;
  isDefault?: boolean;
};

function compareSystemVoice(
  a: SystemVoiceOption,
  b: SystemVoiceOption,
): number {
  if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
  return a.label.localeCompare(b.label) || a.lang.localeCompare(b.lang);
}

export function getSystemVoiceOptions(
  voices: SpeechSynthesisVoice[],
): SystemVoiceOption[] {
  const deduped = new Map<string, SystemVoiceOption>();
  for (const voice of voices) {
    const option: SystemVoiceOption = {
      id: voice.voiceURI || voice.name,
      label: voice.name,
      lang: voice.lang || "und",
      isDefault: voice.default,
    };
    const existing = deduped.get(option.id);
    if (!existing || (!existing.isDefault && option.isDefault)) {
      deduped.set(option.id, option);
    }
  }
  return Array.from(deduped.values()).sort(compareSystemVoice);
}

export function groupSystemVoices(
  voices: SpeechSynthesisVoice[],
): VoiceOptionGroup[] {
  const grouped = new Map<string, SystemVoiceOption[]>();
  for (const voice of getSystemVoiceOptions(voices)) {
    const bucket = grouped.get(voice.lang) ?? [];
    bucket.push(voice);
    grouped.set(voice.lang, bucket);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => compareVoiceLanguage(a, b))
    .map(
      ([lang, items]) =>
        [
          lang,
          [...items]
            .sort(compareSystemVoice)
            .map((v) => ({ id: v.id, label: v.label })),
        ] as const,
    );
}

/** 将语种分组转为 AppCustomSelect 列表项（含分组标题） */
export function voiceGroupsToSelectItems(
  groups: readonly VoiceOptionGroup[],
): CustomSelectItem[] {
  const items: CustomSelectItem[] = [];
  for (const [locale, options] of groups) {
    items.push({ kind: "groupLabel", label: getLocaleDisplayLabel(locale) });
    for (const opt of options) {
      items.push({ kind: "item", id: opt.id, label: opt.label });
    }
  }
  return items;
}

export function flatVoiceOptionsToSelectItems(
  options: readonly VoiceSelectOption[],
): CustomSelectItem[] {
  return options.map((o) => ({
    kind: "item" as const,
    id: o.id,
    label: o.label,
  }));
}

export function resolveVoiceReadDisplayLabel(
  engine: VoiceReadEngineId,
  voiceId: string,
  systemVoices: SpeechSynthesisVoice[],
): string {
  const id = voiceId.trim();
  if (!id) return "";

  if (engine === "edge") {
    const v = findEdgeTtsVoice(id);
    return v?.name ?? id.replace(/Neural$/u, "");
  }
  if (engine === "dashscope") {
    return DASHSCOPE_TTS_VOICES.find((v) => v.id === id)?.label ?? id;
  }
  const sys = getSystemVoiceOptions(systemVoices).find((v) => v.id === id);
  return sys?.label ?? id;
}
