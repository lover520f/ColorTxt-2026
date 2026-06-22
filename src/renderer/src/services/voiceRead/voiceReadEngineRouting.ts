import {
  isMimoTtsVoiceCloneModel,
  normalizeMimoTtsModel,
} from "@shared/voiceReadMimoModels";
import {
  getVoiceReadEngineMeta,
  voiceReadEngineUsesPcmPlayback,
  type VoiceReadEngineId,
} from "@shared/voiceReadEngines";
import type { VoiceReadSettings } from "../../constants/voiceRead";
import {
  VOICE_READ_CHUNK_UNITS_DEFAULT,
  VOICE_READ_CHUNK_UNITS_EDGE,
} from "./voiceReadTextChunks";

export type VoiceReadPlaybackKind = "system" | "pcm" | "decoded";

export function voiceReadPlaybackKind(
  engine: VoiceReadEngineId,
): VoiceReadPlaybackKind {
  if (engine === "system") return "system";
  if (voiceReadEngineUsesPcmPlayback(engine)) return "pcm";
  return "decoded";
}

export function voiceReadChunkUnitsForEngine(engine: VoiceReadEngineId): number {
  return getVoiceReadEngineMeta(engine).shortChunks
    ? VOICE_READ_CHUNK_UNITS_EDGE
    : VOICE_READ_CHUNK_UNITS_DEFAULT;
}

/** MiMo 声音复刻每段都上传参考音，并行预取易导致 API/排播乱序 */
export function voiceReadRequiresSerialChunkFetch(
  settings: VoiceReadSettings,
): boolean {
  if (settings.engine !== "mimo") return false;
  return isMimoTtsVoiceCloneModel(
    normalizeMimoTtsModel(settings.engineConfig.mimoModel),
  );
}

export function voiceReadEdgeFetchBufferSize(settings: VoiceReadSettings): number {
  return voiceReadRequiresSerialChunkFetch(settings) ? 1 : 4;
}
