/**
 * Edge TTS 音色列表
 */

export type EdgeTtsVoice = {
  id: string;
  name: string;
  lang: string;
};

const EDGE_TTS_VOICE_MAP: Record<string, string[]> = {
  "af-ZA": ["af-ZA-AdriNeural", "af-ZA-WillemNeural"],
  "ar-SA": ["ar-SA-HamedNeural", "ar-SA-ZariyahNeural"],
  "bg-BG": ["bg-BG-BorislavNeural", "bg-BG-KalinaNeural"],
  "ca-ES": ["ca-ES-EnricNeural", "ca-ES-JoanaNeural"],
  "cs-CZ": ["cs-CZ-AntoninNeural", "cs-CZ-VlastaNeural"],
  "da-DK": ["da-DK-ChristelNeural", "da-DK-JeppeNeural"],
  "de-DE": [
    "de-DE-AmalaNeural",
    "de-DE-ConradNeural",
    "de-DE-FlorianMultilingualNeural",
    "de-DE-KatjaNeural",
    "de-DE-KillianNeural",
    "de-DE-SeraphinaMultilingualNeural",
  ],
  "el-GR": ["el-GR-AthinaNeural", "el-GR-NestorasNeural"],
  "en-AU": ["en-AU-NatashaNeural", "en-AU-WilliamNeural"],
  "en-CA": ["en-CA-ClaraNeural", "en-CA-LiamNeural"],
  "en-GB": [
    "en-GB-LibbyNeural",
    "en-GB-MaisieNeural",
    "en-GB-RyanNeural",
    "en-GB-SoniaNeural",
    "en-GB-ThomasNeural",
  ],
  "en-IN": [
    "en-IN-NeerjaExpressiveNeural",
    "en-IN-NeerjaNeural",
    "en-IN-PrabhatNeural",
  ],
  "en-US": [
    "en-US-AriaNeural",
    "en-US-AndrewMultilingualNeural",
    "en-US-AndrewNeural",
    "en-US-AvaMultilingualNeural",
    "en-US-AvaNeural",
    "en-US-BrianMultilingualNeural",
    "en-US-BrianNeural",
    "en-US-ChristopherNeural",
    "en-US-EmmaMultilingualNeural",
    "en-US-EmmaNeural",
    "en-US-EricNeural",
    "en-US-GuyNeural",
    "en-US-JennyNeural",
    "en-US-MichelleNeural",
    "en-US-RogerNeural",
    "en-US-SteffanNeural",
  ],
  "es-ES": ["es-ES-AlvaroNeural", "es-ES-ElviraNeural", "es-ES-XimenaNeural"],
  "es-MX": ["es-MX-DaliaNeural", "es-MX-JorgeNeural"],
  "fi-FI": ["fi-FI-HarriNeural", "fi-FI-NooraNeural"],
  "fr-CA": ["fr-CA-AntoineNeural", "fr-CA-JeanNeural", "fr-CA-SylvieNeural"],
  "fr-FR": [
    "fr-FR-DeniseNeural",
    "fr-FR-EloiseNeural",
    "fr-FR-HenriNeural",
    "fr-FR-RemyMultilingualNeural",
    "fr-FR-VivienneMultilingualNeural",
  ],
  "he-IL": ["he-IL-AvriNeural", "he-IL-HilaNeural"],
  "hi-IN": ["hi-IN-MadhurNeural", "hi-IN-SwaraNeural"],
  "hr-HR": ["hr-HR-GabrijelaNeural", "hr-HR-SreckoNeural"],
  "hu-HU": ["hu-HU-NoemiNeural", "hu-HU-TamasNeural"],
  "id-ID": ["id-ID-ArdiNeural", "id-ID-GadisNeural"],
  "it-IT": [
    "it-IT-DiegoNeural",
    "it-IT-ElsaNeural",
    "it-IT-GiuseppeMultilingualNeural",
    "it-IT-IsabellaNeural",
  ],
  "ja-JP": ["ja-JP-KeitaNeural", "ja-JP-NanamiNeural"],
  "ko-KR": [
    "ko-KR-HyunsuMultilingualNeural",
    "ko-KR-InJoonNeural",
    "ko-KR-SunHiNeural",
  ],
  "ms-MY": ["ms-MY-OsmanNeural", "ms-MY-YasminNeural"],
  "nb-NO": ["nb-NO-FinnNeural", "nb-NO-PernilleNeural"],
  "nl-NL": ["nl-NL-ColetteNeural", "nl-NL-FennaNeural", "nl-NL-MaartenNeural"],
  "pl-PL": ["pl-PL-MarekNeural", "pl-PL-ZofiaNeural"],
  "pt-BR": [
    "pt-BR-AntonioNeural",
    "pt-BR-FranciscaNeural",
    "pt-BR-ThalitaMultilingualNeural",
  ],
  "pt-PT": ["pt-PT-DuarteNeural", "pt-PT-RaquelNeural"],
  "ro-RO": ["ro-RO-AlinaNeural", "ro-RO-EmilNeural"],
  "ru-RU": ["ru-RU-DmitryNeural", "ru-RU-SvetlanaNeural"],
  "sk-SK": ["sk-SK-LukasNeural", "sk-SK-ViktoriaNeural"],
  "sv-SE": ["sv-SE-MattiasNeural", "sv-SE-SofieNeural"],
  "th-TH": ["th-TH-NiwatNeural", "th-TH-PremwadeeNeural"],
  "tr-TR": ["tr-TR-AhmetNeural", "tr-TR-EmelNeural"],
  "uk-UA": ["uk-UA-OstapNeural", "uk-UA-PolinaNeural"],
  "vi-VN": ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"],
  "zh-CN": [
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-XiaoyiNeural",
    "zh-CN-YunjianNeural",
    "zh-CN-YunxiNeural",
    "zh-CN-YunxiaNeural",
    "zh-CN-YunyangNeural",
    "zh-CN-liaoning-XiaobeiNeural",
    "zh-CN-shaanxi-XiaoniNeural",
  ],
  "zh-HK": [
    "zh-HK-HiuGaaiNeural",
    "zh-HK-HiuMaanNeural",
    "zh-HK-WanLungNeural",
  ],
  "zh-TW": [
    "zh-TW-HsiaoChenNeural",
    "zh-TW-HsiaoYuNeural",
    "zh-TW-YunJheNeural",
  ],
};

function buildEdgeTtsVoiceList(): EdgeTtsVoice[] {
  return Object.entries(EDGE_TTS_VOICE_MAP).flatMap(([lang, voices]) =>
    voices.map((id) => ({
      id,
      name: id.replace(`${lang}-`, "").replace(/Neural$/u, ""),
      lang,
    })),
  );
}

/** 完整 Edge Neural 音色表 */
export const EDGE_TTS_VOICES: EdgeTtsVoice[] = buildEdgeTtsVoiceList();

export function findEdgeTtsVoice(id: string): EdgeTtsVoice | undefined {
  return EDGE_TTS_VOICES.find((v) => v.id === id);
}
