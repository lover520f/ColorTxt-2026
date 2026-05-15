import type { VoiceReadEdgeTtsRequest } from "@shared/voiceReadEdgeIpc";

export type VoiceReadEngineId = "system" | "edge" | "dashscope";

/** 与 localStorage / SettingsApplyPayload 对齐的语音朗读设置 */
export type VoiceReadSettings = {
  engine: VoiceReadEngineId;
  /** 系统：voiceURI；Edge：完整 voice id；DashScope：音色名 */
  voiceId: string;
  /** 0.5–2，对应 SpeechSynthesis rate 风格 */
  rate: number;
  /** 0.5–2，对应 SpeechSynthesis pitch 风格 */
  pitch: number;
  dashscopeApiKey: string;
};

export const defaultVoiceReadSettings: VoiceReadSettings = {
  engine: "edge",
  voiceId: "zh-CN-XiaoxiaoNeural",
  rate: 1,
  pitch: 1,
  dashscopeApiKey: "",
};

export const voiceReadRateMin = 0.5;
export const voiceReadRateMax = 2;
export const voiceReadPitchMin = 0.5;
export const voiceReadPitchMax = 2;

/** DashScope qwen3-tts-flash 音色 */
export const DASHSCOPE_TTS_VOICES: { id: string; label: string }[] = [
  { id: "Cherry", label: "芊悦 (Cherry)" },
  { id: "Ethan", label: "晨煦 (Ethan)" },
  { id: "Nofish", label: "不吃鱼 (Nofish)" },
  { id: "Ryan", label: "甜茶 (Ryan)" },
  { id: "Katerina", label: "卡捷琳娜 (Katerina)" },
  { id: "Dylan", label: "北京-晓东 (Dylan)" },
  { id: "Sunny", label: "四川-晴儿 (Sunny)" },
  { id: "Peter", label: "天津-李彼得 (Peter)" },
  { id: "Rocky", label: "粤语-阿强 (Rocky)" },
  { id: "Kiki", label: "粤语-阿清 (Kiki)" },
];

export function clampVoiceReadRate(v: number): number {
  if (!Number.isFinite(v)) return defaultVoiceReadSettings.rate;
  return Math.max(voiceReadRateMin, Math.min(voiceReadRateMax, v));
}

export function clampVoiceReadPitch(v: number): number {
  if (!Number.isFinite(v)) return defaultVoiceReadSettings.pitch;
  return Math.max(voiceReadPitchMin, Math.min(voiceReadPitchMax, v));
}

export function mergeVoiceReadSettings(
  raw: Partial<VoiceReadSettings> | undefined,
): VoiceReadSettings {
  const d = defaultVoiceReadSettings;
  if (!raw || typeof raw !== "object") return { ...d };
  const engine: VoiceReadEngineId =
    raw.engine === "edge" ||
    raw.engine === "dashscope" ||
    raw.engine === "system"
      ? raw.engine
      : d.engine;
  return {
    engine,
    voiceId: typeof raw.voiceId === "string" ? raw.voiceId : d.voiceId,
    rate: clampVoiceReadRate(typeof raw.rate === "number" ? raw.rate : d.rate),
    pitch: clampVoiceReadPitch(
      typeof raw.pitch === "number" ? raw.pitch : d.pitch,
    ),
    dashscopeApiKey:
      typeof raw.dashscopeApiKey === "string"
        ? raw.dashscopeApiKey
        : d.dashscopeApiKey,
  };
}

/** 已选 DashScope 但未填写 API 密钥 */
export function voiceReadDashScopeRequiresApiKey(
  settings: Pick<VoiceReadSettings, "engine" | "dashscopeApiKey">,
): boolean {
  return settings.engine === "dashscope" && !settings.dashscopeApiKey.trim();
}

export function voiceReadEngineSupportsPitch(
  engine: VoiceReadEngineId,
): boolean {
  return engine === "system" || engine === "edge";
}

export function voiceReadEngineSupportsRate(
  engine: VoiceReadEngineId,
): boolean {
  return engine === "system" || engine === "edge" || engine === "dashscope";
}

/** Edge 请求用：从 voice id 推断 xml:lang */
export function inferLangFromEdgeVoiceId(voiceId: string): string {
  const idx = voiceId.indexOf("-");
  if (idx <= 0) return "zh-CN";
  const second = voiceId.indexOf("-", idx + 1);
  if (second < 0) return "zh-CN";
  return voiceId.slice(0, second);
}

export function toVoiceReadEdgeTtsRequest(
  settings: VoiceReadSettings,
  text: string,
): VoiceReadEdgeTtsRequest {
  const voice = settings.voiceId.trim() || "zh-CN-XiaoxiaoNeural";
  return {
    text,
    voice,
    lang: inferLangFromEdgeVoiceId(voice),
    rate: settings.rate,
    pitch: settings.pitch,
  };
}
