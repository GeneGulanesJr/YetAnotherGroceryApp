import { and, eq, isNull } from "drizzle-orm";
import { images, type ImageRecord } from "../schema";
import { now } from "../context";
import { trackInsert, trackUpdate } from "../outbox";
import type { Db } from "../types";

export interface ImageInput {
  localUri?: string | null;
  thumbnailUri?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  sha256?: string | null;
  capturedAt?: Date;
}

/**
 * Persists image metadata after the file pipeline (compress/thumbnail) has
 * written the bytes to disk. Binary data never enters SQLite (spec).
 */
export function createImageRecord(db: Db, input: ImageInput): ImageRecord {
  return trackInsert(db, images, {
    localUri: input.localUri ?? null,
    remoteObjectKey: null,
    thumbnailUri: input.thumbnailUri ?? null,
    mimeType: input.mimeType ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    fileSize: input.fileSize ?? null,
    sha256: input.sha256 ?? null,
    uploadStatus: "pending",
    capturedAt: input.capturedAt ?? now(),
  });
}

export function markImageUploaded(
  db: Db,
  id: string,
  remoteObjectKey: string,
): ImageRecord | undefined {
  return trackUpdate(db, images, id, {
    remoteObjectKey,
    uploadStatus: "uploaded",
  });
}

export function getImageRecord(db: Db, id: string): ImageRecord | undefined {
  return db
    .select()
    .from(images)
    .where(and(eq(images.id, id), isNull(images.deletedAt)))
    .get();
}
