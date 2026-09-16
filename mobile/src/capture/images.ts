import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { sha256 } from "js-sha256";

import { newId } from "../db/context";
import { createImageRecord } from "../db/repositories/images";
import type { ImageRecord } from "../db/schema";
import type { Db } from "../db/types";

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
