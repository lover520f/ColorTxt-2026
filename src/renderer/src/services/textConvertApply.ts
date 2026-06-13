import {
  convertDigitsWidth,
  convertLettersWidth,
} from "@shared/textWidthConvert";
import {
  resolveOpenCcConfig,
  type TextConvertWidthMode,
  type TextConvertZhMode,
} from "@shared/textConvertTypes";

export type TextDisplayConvertOptions = {
  zh: TextConvertZhMode;
  letter: TextConvertWidthMode;
  digit: TextConvertWidthMode;
};

export async function applyTextDisplayConverts(
  text: string,
  options: TextDisplayConvertOptions,
): Promise<string> {
  let result = text;
  const openCcConfig = resolveOpenCcConfig(options.zh);
  if (openCcConfig) {
    result = await window.colorTxt.convertTextOpenCc(result, openCcConfig);
  }
  if (options.letter !== "off") {
    result = convertLettersWidth(result, options.letter);
  }
  if (options.digit !== "off") {
    result = convertDigitsWidth(result, options.digit);
  }
  return result;
}

export async function applyTextConvertZh(
  text: string,
  mode: TextConvertZhMode,
): Promise<string> {
  const config = resolveOpenCcConfig(mode);
  if (!config) return text;
  return window.colorTxt.convertTextOpenCc(text, config);
}

export function applyTextConvertLetters(
  text: string,
  mode: TextConvertWidthMode,
): string {
  return convertLettersWidth(text, mode);
}

export function applyTextConvertDigits(
  text: string,
  mode: TextConvertWidthMode,
): string {
  return convertDigitsWidth(text, mode);
}
