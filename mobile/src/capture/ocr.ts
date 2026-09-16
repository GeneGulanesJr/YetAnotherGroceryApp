import { isSupported, recognizeText } from "expo-mlkit-ocr";
import type { RecognitionResult } from "expo-mlkit-ocr";

import type { OcrLine } from "./priceParse";

/**
 * Thin engine wrapper. expo-mlkit-ocr bundles Google ML Kit Text Recognition
 * v2 models, fully on-device/offline. In Expo Go (no native module) this
 * degrades to null and callers fall back to manual entry.
 */

export interface OcrResult {
  text: string;
  lines: OcrLine[];
  /** Raw library result for OCRTextOverlay rendering. */
  raw: RecognitionResult;
}

export function ocrAvailable(): boolean {
  try {
    return isSupported();
  } catch {
    return false;
  }
}

/** Runs on-device OCR over a photo; returns null when unavailable or failed. */
export async function runOcr(imageUri: string): Promise<OcrResult | null> {
  if (!ocrAvailable()) {
    return null;
  }
  try {
    const raw = await recognizeText(imageUri);
    return {
      text: raw.text,
      raw,
      lines: raw.blocks.flatMap((block) =>
        block.lines.map((line) => ({ text: line.text, bbox: line.boundingBox })),
      ),
    };
  } catch {
    return null;
  }
}
