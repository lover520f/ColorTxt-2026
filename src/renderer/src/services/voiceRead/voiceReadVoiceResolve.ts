import type { CharacterRosterEntry } from "@shared/characterTypes";
import { parseCharacterAliasesInput } from "@shared/characterAliases";
import {
  voiceReadEmotionActive,
  type VoiceReadEmotionId,
  VOICE_READ_EMOTION_AUTO,
} from "@shared/voiceReadEmotion";
import type { VoiceReadQuoteAttribution } from "@shared/voiceReadSpeakerIpc";
import type { VoiceReadSettings } from "../../constants/voiceRead";
import {
  voiceReadMultiDialogueFemaleVoiceId,
  voiceReadMultiDialogueMaleVoiceId,
  voiceReadMultiDialogueVoiceId,
  voiceReadMultiNarrationVoiceId,
  voiceReadSingleVoiceId,
} from "../../constants/voiceRead";
import { voiceReadEngineSupportsMultiVoiceScheme } from "@shared/voiceReadEngines";
import type { VoiceReadTextSegment } from "./voiceReadSegments";

export type VoiceReadSpeakChunk = {
  text: string;
  voiceId: string;
  emotion?: VoiceReadEmotionId;
};

function aliasDedupeKey(s: string): string {
  return s.trim().toLowerCase();
}

function findCharacterBySpeaker(
  roster: readonly CharacterRosterEntry[],
  speaker: string | null | undefined,
): CharacterRosterEntry | undefined {
  const key = speaker?.trim();
  if (!key) return undefined;
  const want = aliasDedupeKey(key);
  for (const entry of roster) {
    if (aliasDedupeKey(entry.displayName) === want) return entry;
    for (const a of parseCharacterAliasesInput(entry.aliases)) {
      if (aliasDedupeKey(a) === want) return entry;
    }
  }
  return undefined;
}

function dialogueFallbackVoiceId(settings: VoiceReadSettings): string {
  return voiceReadMultiDialogueVoiceId(settings);
}

function maleDialogueVoiceId(settings: VoiceReadSettings): string {
  return voiceReadMultiDialogueMaleVoiceId(settings);
}

function femaleDialogueVoiceId(settings: VoiceReadSettings): string {
  return voiceReadMultiDialogueFemaleVoiceId(settings);
}

export function resolveSegmentVoiceId(
  settings: VoiceReadSettings,
  segment: Pick<VoiceReadTextSegment, "kind">,
  roster: readonly CharacterRosterEntry[],
  quoteAttr?: VoiceReadQuoteAttribution | null,
  aiFeaturesEnabled = false,
): string {
  if (
    settings.scheme === "single" ||
    !voiceReadEngineSupportsMultiVoiceScheme(
      settings.engine,
      settings.engineConfig,
    )
  ) {
    return voiceReadSingleVoiceId(settings);
  }
  if (segment.kind === "narration") {
    return voiceReadMultiNarrationVoiceId(settings);
  }

  const aiOn = aiFeaturesEnabled && quoteAttr != null;
  if (aiOn && quoteAttr.kind === "narration") {
    return voiceReadMultiNarrationVoiceId(settings);
  }

  if (!aiOn) {
    return dialogueFallbackVoiceId(settings);
  }

  const hit = findCharacterBySpeaker(roster, quoteAttr.speaker);
  const charVoice = hit?.voiceReadVoiceId?.trim();
  if (charVoice) return charVoice;
  if (hit?.gender === "male") return maleDialogueVoiceId(settings);
  if (hit?.gender === "female") return femaleDialogueVoiceId(settings);
  if (quoteAttr.kind === "male") return maleDialogueVoiceId(settings);
  if (quoteAttr.kind === "female") return femaleDialogueVoiceId(settings);
  return dialogueFallbackVoiceId(settings);
}

function resolveChunkEmotion(
  segment: Pick<VoiceReadTextSegment, "kind">,
  quoteEmotion: VoiceReadEmotionId | undefined,
  narrationEmotion: VoiceReadEmotionId | undefined,
  emotionActive: boolean,
): VoiceReadEmotionId | undefined {
  if (!emotionActive) return undefined;
  if (segment.kind === "narration") {
    const e = narrationEmotion ?? VOICE_READ_EMOTION_AUTO;
    return e === VOICE_READ_EMOTION_AUTO ? undefined : e;
  }
  const e = quoteEmotion ?? VOICE_READ_EMOTION_AUTO;
  return e === VOICE_READ_EMOTION_AUTO ? undefined : e;
}

export function resolveSpeakChunk(
  settings: VoiceReadSettings,
  segment: VoiceReadTextSegment,
  roster: readonly CharacterRosterEntry[],
  quoteAttr?: VoiceReadQuoteAttribution | null,
  aiFeaturesEnabled = false,
  narrationEmotion?: VoiceReadEmotionId,
): VoiceReadSpeakChunk {
  const emotionActive =
    voiceReadEmotionActive(settings) && aiFeaturesEnabled;
  return {
    text: segment.text,
    voiceId: resolveSegmentVoiceId(
      settings,
      segment,
      roster,
      quoteAttr,
      aiFeaturesEnabled,
    ),
    emotion: resolveChunkEmotion(
      segment,
      quoteAttr?.emotion,
      narrationEmotion,
      emotionActive,
    ),
  };
}
