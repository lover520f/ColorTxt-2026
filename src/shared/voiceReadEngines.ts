/** 语音朗读引擎注册表（主进程 / preload / renderer 对齐） */

import {
  DASHSCOPE_PLATFORM_LABEL,
  MIMO_PLATFORM_LABEL,
} from "./apiEndpointPresets";
import type { VoiceReadEngineConfig } from "./voiceReadEngineConfig";
import {
  isMimoTtsPresetModel,
  normalizeMimoTtsModel,
} from "./voiceReadMimoModels";
import { defaultVoiceIdForEngine } from "./voiceReadEngineDefaults";

export {
  defaultMultiVoiceIdsForEngine,
  defaultSingleVoiceIdForEngine,
  defaultVoiceIdForEngine,
  DEFAULT_DASHSCOPE_TTS_MODEL,
  DEFAULT_MIMO_TTS_MODEL,
  DEFAULT_MINIMAX_TTS_MODEL,
  VOICE_READ_ENGINE_DEFAULTS,
} from "./voiceReadEngineDefaults";

export type VoiceReadEngineId =
  | "system"
  | "edge"
  | "dashscope"
  | "minimax"
  | "mimo";

export type VoiceReadEngineKind = "browser" | "ipc";
export type VoiceReadEngineAuth = "none" | "apiKey";
export type VoiceReadEngineVoiceSource = "static" | "dynamic";
export type VoiceReadEngineAudioFormat = "mp3" | "wav" | "pcm_s16le";

export type VoiceReadEngineMeta = {
  id: VoiceReadEngineId;
  label: string;
  description: string;
  kind: VoiceReadEngineKind;
  auth: VoiceReadEngineAuth;
  supportsRate: boolean;
  supportsPitch: boolean;
  voiceSource: VoiceReadEngineVoiceSource;
  audioFormat: VoiceReadEngineAudioFormat;
  /** 相对默认切段单位：edge 较短 */
  shortChunks: boolean;
  defaultVoiceId: string;
};

type VoiceReadEngineMetaBase = Omit<VoiceReadEngineMeta, "defaultVoiceId">;

const ENGINE_LIST_BASE: VoiceReadEngineMetaBase[] = [
  {
    id: "edge",
    label: "Edge TTS",
    description: "免费高质量微软 Neural 语音，需联网",
    kind: "ipc",
    auth: "none",
    supportsRate: true,
    supportsPitch: true,
    voiceSource: "static",
    audioFormat: "mp3",
    shortChunks: true,
  },
  {
    id: "system",
    label: "系统语音",
    description: "免费离线，使用设备系统语音",
    kind: "browser",
    auth: "none",
    supportsRate: true,
    supportsPitch: true,
    voiceSource: "dynamic",
    audioFormat: "mp3",
    shortChunks: false,
  },
  {
    id: "dashscope",
    label: DASHSCOPE_PLATFORM_LABEL,
    description: "云端 Qwen3-TTS，需要 API 密钥",
    kind: "ipc",
    auth: "apiKey",
    supportsRate: true,
    supportsPitch: false,
    voiceSource: "static",
    audioFormat: "pcm_s16le",
    shortChunks: false,
  },
  {
    id: "minimax",
    label: "MiniMax",
    description: "云端 TTS，需要 API 密钥",
    kind: "ipc",
    auth: "apiKey",
    supportsRate: true,
    supportsPitch: false,
    voiceSource: "dynamic",
    audioFormat: "mp3",
    shortChunks: false,
  },
  {
    id: "mimo",
    label: MIMO_PLATFORM_LABEL,
    description: "云端 TTS，支持音色定制、音色克隆，需要 API 密钥",
    kind: "ipc",
    auth: "apiKey",
    supportsRate: true,
    supportsPitch: false,
    voiceSource: "static",
    audioFormat: "wav",
    shortChunks: false,
  },
];

const ENGINE_LIST: VoiceReadEngineMeta[] = ENGINE_LIST_BASE.map((meta) => ({
  ...meta,
  defaultVoiceId: defaultVoiceIdForEngine(meta.id),
}));

// wav 引擎在播放器侧与 mp3 共用 decodeAudioData 路径
export type VoiceReadEngineMetaResolved = VoiceReadEngineMeta & {
  usesDecodedPlayback: boolean;
};

function resolveMeta(meta: VoiceReadEngineMeta): VoiceReadEngineMetaResolved {
  return {
    ...meta,
    usesDecodedPlayback:
      meta.audioFormat === "mp3" || meta.audioFormat === "wav",
  };
}

const ENGINE_MAP = new Map<VoiceReadEngineId, VoiceReadEngineMetaResolved>(
  ENGINE_LIST.map((m) => [m.id, resolveMeta(m)]),
);

export const VOICE_READ_ENGINE_REGISTRY: readonly VoiceReadEngineMetaResolved[] =
  ENGINE_LIST.map(resolveMeta);

export const VOICE_READ_ENGINE_IDS: readonly VoiceReadEngineId[] =
  ENGINE_LIST.map((m) => m.id);

const VALID_ENGINE_IDS = new Set<string>(VOICE_READ_ENGINE_IDS);

export function isVoiceReadEngineId(raw: unknown): raw is VoiceReadEngineId {
  return typeof raw === "string" && VALID_ENGINE_IDS.has(raw);
}

export function getVoiceReadEngineMeta(
  engine: VoiceReadEngineId,
): VoiceReadEngineMetaResolved {
  return ENGINE_MAP.get(engine) ?? ENGINE_MAP.get("edge")!;
}

export function voiceReadEngineUsesIpc(engine: VoiceReadEngineId): boolean {
  return getVoiceReadEngineMeta(engine).kind === "ipc";
}

export function voiceReadEngineUsesMp3Playback(
  engine: VoiceReadEngineId,
): boolean {
  const meta = getVoiceReadEngineMeta(engine);
  return meta.usesDecodedPlayback;
}

export function voiceReadEngineUsesPcmPlayback(
  engine: VoiceReadEngineId,
): boolean {
  return getVoiceReadEngineMeta(engine).audioFormat === "pcm_s16le";
}

export function voiceReadEngineRequiresApiKey(
  engine: VoiceReadEngineId,
  config: VoiceReadEngineConfig,
): boolean {
  const meta = getVoiceReadEngineMeta(engine);
  if (meta.auth !== "apiKey") return false;
  if (engine === "dashscope") return !config.dashscopeApiKey?.trim();
  if (engine === "minimax") return !config.minimaxApiKey?.trim();
  if (engine === "mimo") return !config.mimoApiKey?.trim();
  return false;
}

export function voiceReadEngineIsConfigured(
  engine: VoiceReadEngineId,
  config: VoiceReadEngineConfig,
): boolean {
  return !voiceReadEngineRequiresApiKey(engine, config);
}

/** MiMo VoiceDesign / VoiceClone 无预置音色列表，仅固定单音色 */
export function voiceReadEngineSupportsMultiVoiceScheme(
  engine: VoiceReadEngineId,
  config: VoiceReadEngineConfig,
): boolean {
  if (engine !== "mimo") return true;
  return isMimoTtsPresetModel(normalizeMimoTtsModel(config.mimoModel));
}

export function normalizeVoiceReadEngineId(
  raw: unknown,
  fallback: VoiceReadEngineId = "edge",
): VoiceReadEngineId {
  return isVoiceReadEngineId(raw) ? raw : fallback;
}
