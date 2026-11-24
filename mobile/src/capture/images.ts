import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { sha256 } from "js-sha256";

import { segmentSubjects, type CutoutSubject } from "../../modules/item-cutout";
import { newId } from "../db/context";
import { createImageRecord, saveImageCutout } from "../db/repositories/images";
import type { ImageRecord } from "../db/schema";
import type { Db } from "../db/types";
import { pickSubject } from "./cutout";
import type { OcrResult } from "./ocr";

/**
 * Image pipeline per tech.mobile.md: compress via expo-image-manipulator,
 * store under the app's document directory (never inside SQLite), keep a
 * thumbnail by default, hash bytes with SHA-256 for duplicate detection,
 * then record metadata with uploadStatus "pending".
 */

const IMAGE_DIR_NAME = "images";
const FULL_MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 400;

function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, IMAGE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

async function renderResized(sourceUri: string, maxWidth: number, compress: number) {
  const context = ImageManipulator.manipulate(sourceUri).resize({ width: maxWidth });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress,
    format: SaveFormat.JPEG,
  });
  return saved;
}

function copyIntoImagesDir(cacheUri: string): File {
  const source = new File(cacheUri);
  const target = new File(imagesDirectory(), `${newId()}.jpg`);
  source.copySync(target);
  return target;
}

export interface IngestedImage {
  record: ImageRecord;
}

/** Persists a picked/captured photo and its thumbnail, returning the DB record. */
export async function ingestImage(db: Db, sourceUri: string): Promise<IngestedImage> {
  const [full, thumb] = await Promise.all([
    renderResized(sourceUri, FULL_MAX_WIDTH, 0.75),
    renderResized(sourceUri, THUMB_MAX_WIDTH, 0.7),
  ]);

  const fullFile = copyIntoImagesDir(full.uri);
  const thumbFile = copyIntoImagesDir(thumb.uri);

  const bytes = fullFile.bytesSync();
  const digest = sha256(bytes);

  const record = createImageRecord(db, {
    localUri: fullFile.uri,
    thumbnailUri: thumbFile.uri,
    mimeType: "image/jpeg",
    width: full.width,
    height: full.height,
    fileSize: fullFile.size ?? full.width * full.height,
    sha256: digest,
    capturedAt: new Date(),
  });

  return { record };
}

/** Deletes a candidate cutout file; a leftover in the cache is harmless. */
export function discardCutout(cutout: CutoutSubject): void {
  try {
    new File(cutout.uri).delete();
  } catch {
    // Already gone.
  }
}

/**
 * Isolates the main product on-device, on the stored image so subject and OCR
 * boxes share one space. Any failure (no model yet, no Play services) is null.
 */
export async function findCutout(record: ImageRecord, ocr: OcrResult | null): Promise<CutoutSubject | null> {
  if (record.localUri === null || record.width === null || record.height === null) {
    return null;
  }
  try {
    const subjects = await segmentSubjects(record.localUri);
    const chosen = pickSubject(subjects, { width: record.width, height: record.height }, ocr?.lines ?? []);
    subjects.filter((subject) => subject !== chosen).forEach(discardCutout);
    return chosen;
  } catch {
    return null;
  }
}

/** Stores the accepted cutout. A failure only means the item keeps its full photo. */
export function keepCutout(db: Db, imageId: string, cutout: CutoutSubject): void {
  const target = new File(imagesDirectory(), `${imageId}-cutout.png`);
  try {
    new File(cutout.uri).copySync(target);
    saveImageCutout(db, { imageId, uri: target.uri, width: cutout.fileWidth, height: cutout.fileHeight });
  } catch {
    discardCutout({ ...cutout, uri: target.uri });
  }
  discardCutout(cutout);
}

/** Opens the photo library for a product photo (permission asked on first use). */
export async function pickProductPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.9,
    selectionLimit: 1,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return result.assets[0].uri;
}
