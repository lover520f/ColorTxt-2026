import type { VoiceReadEngineConfig } from "./voiceReadEngineConfig";
import type { VoiceReadEngineId } from "./voiceReadEngines";
import {
  dashscopeTtsModelSupportsInstructions,
  normalizeDashscopeTtsModel,
} from "./voiceReadDashscopeModels";

/** auto：不传情绪参数，由引擎根据文本推断 */
export const VOICE_READ_EMOTION_AUTO = "auto" as const;

export type VoiceReadEmotionId =
  | typeof VOICE_READ_EMOTION_AUTO
  | "happy"
  | "sad"
  | "worried"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "calm"
  | "fluent"
  | "whisper";

export type VoiceReadEmotionLabel = Exclude<VoiceReadEmotionId, "auto">;

const EMOTION_LABELS: readonly VoiceReadEmotionLabel[] = [
  "happy",
  "sad",
  "worried",
  "angry",
  "fearful",
  "disgusted",
  "surprised",
  "calm",
  "fluent",
  "whisper",
];

const EMOTION_ALIASES: Record<string, VoiceReadEmotionLabel> = {
  auto: "calm",
  happy: "happy",
  高兴: "happy",
  开心: "happy",
  快乐: "happy",
  sad: "sad",
  悲伤: "sad",
  难过: "sad",
  worried: "worried",
  担心: "worried",
  关切: "worried",
  忧虑: "worried",
  angry: "angry",
  愤怒: "angry",
  生气: "angry",
  fearful: "fearful",
  害怕: "fearful",
  恐惧: "fearful",
  disgusted: "disgusted",
  厌恶: "disgusted",
  surprised: "surprised",
  惊讶: "surprised",
  calm: "calm",
  平静: "calm",
  中性: "calm",
  fluent: "fluent",
  生动: "fluent",
  whisper: "whisper",
  低语: "whisper",
};

export function normalizeVoiceReadEmotion(raw: unknown): VoiceReadEmotionId {
  if (raw === null || raw === undefined) return VOICE_READ_EMOTION_AUTO;
  if (typeof raw !== "string") return VOICE_READ_EMOTION_AUTO;
  const key = raw.trim().toLowerCase();
  if (!key || key === "auto") return VOICE_READ_EMOTION_AUTO;
  if ((EMOTION_LABELS as readonly string[]).includes(key)) {
    return key as VoiceReadEmotionLabel;
  }
  const mapped = EMOTION_ALIASES[key] ?? EMOTION_ALIASES[raw.trim()];
  return mapped ?? VOICE_READ_EMOTION_AUTO;
}

export function isVoiceReadEmotionLabel(
  id: VoiceReadEmotionId,
): id is VoiceReadEmotionLabel {
  return id !== VOICE_READ_EMOTION_AUTO;
}

const EMOTION_ENGINE_SUPPORT = new Set<VoiceReadEngineId>([
  "minimax",
  "dashscope",
  "mimo",
]);

export function voiceReadEngineSupportsEmotion(
  engine: VoiceReadEngineId,
  engineConfig?: VoiceReadEngineConfig,
): boolean {
  if (engine === "dashscope") {
    if (!engineConfig) return false;
    return dashscopeTtsModelSupportsInstructions(
      normalizeDashscopeTtsModel(engineConfig.dashscopeModel),
    );
  }
  return EMOTION_ENGINE_SUPPORT.has(engine);
}

/** 用户开启且当前引擎/模型支持情绪参数 */
export function voiceReadEmotionActive(settings: {
  engine: VoiceReadEngineId;
  engineConfig?: VoiceReadEngineConfig;
  emotionEnabled?: boolean;
}): boolean {
  if (settings.emotionEnabled === false) return false;
  return voiceReadEngineSupportsEmotion(
    settings.engine,
    settings.engineConfig,
  );
}

const DASHSCOPE_EMOTION_INSTRUCTIONS: Record<VoiceReadEmotionLabel, string> = {
  happy: "语气开心、轻松愉快，富有感染力。",
  sad: "语气悲伤、低沉，带有压抑感。",
  worried: "语气关切、略带担忧，语速略慢。",
  angry: "语气愤怒、强硬，情绪外露。",
  fearful: "语气害怕、紧张，略显颤抖。",
  disgusted: "语气厌恶、不屑，带有排斥感。",
  surprised: "语气惊讶、意外，情绪起伏明显。",
  calm: "语气平静、自然，不夸张。",
  fluent: "语气生动、富有表现力，节奏流畅。",
  whisper: "语气低语、轻声，像在说悄悄话。",
};

export function mapEmotionForDashScope(
  emotion: VoiceReadEmotionId | undefined,
): string | undefined {
  if (!emotion || emotion === VOICE_READ_EMOTION_AUTO) return undefined;
  return DASHSCOPE_EMOTION_INSTRUCTIONS[emotion];
}

/** MiniMax speech-2.8 不支持 whisper；fluent/whisper 仅部分 2.6 模型支持 */
export function mapEmotionForMiniMax(
  emotion: VoiceReadEmotionId | undefined,
  model: string,
): string | undefined {
  if (!emotion || emotion === VOICE_READ_EMOTION_AUTO) return undefined;
  const modelId = model.trim().toLowerCase();
  if (emotion === "worried") return "fearful";
  if (emotion === "whisper" && modelId.includes("2.8")) return undefined;
  if (
    (emotion === "fluent" || emotion === "whisper") &&
    !modelId.includes("2.6") &&
    !modelId.includes("02") &&
    !modelId.includes("01")
  ) {
    if (emotion === "whisper") return undefined;
  }
  return emotion;
}

/** MiMo 通过 user 消息传递自然语言风格指令 */
export function mapEmotionForMimo(
  emotion: VoiceReadEmotionId | undefined,
): string | undefined {
  return mapEmotionForDashScope(emotion);
}

export function voiceReadEmotionCacheToken(
  emotion: VoiceReadEmotionId | undefined,
): string {
  return emotion?.trim() || VOICE_READ_EMOTION_AUTO;
}
