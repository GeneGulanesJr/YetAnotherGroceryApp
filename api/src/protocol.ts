/**
 * Wire protocol for the pull/push delta sync.
 *
 * KEPT IN SYNC WITH `mobile/src/sync/protocol.ts` (same shapes, camelCase).
 * That file is the contract source: the mobile/desktop sync engines are built
 * against these types, so any change here must be mirrored there.
 *
 * Timestamps are UTC epoch milliseconds. The server is authoritative for
 * assignment/monotonicity of `revision`; conflict resolution is
 * last-write-wins per field via `fieldVersions` (field -> epoch ms).
 */

export type SyncOperation = "insert" | "update" | "delete";

/** Client -> server mutation envelope (from the sync_mutations outbox). */
export interface SyncMutationDto {
  id: string;
  tableName: string;
  recordId: string;
  operation: SyncOperation;
  changedFields: string[] | null;
  payload: Record<string, unknown> | null;
  deviceId: string;
  createdAt: number;
  localRevision: number;
}

export interface PushBatchRequest {
  deviceId: string;
  mutations: SyncMutationDto[];
}

export interface PushMutationResult {
  mutationId: string;
  accepted: boolean;
  /** Server-assigned monotonic revision for the record. */
  revision: number;
  /** Server-assigned authoritative updated_at (epoch ms) on accept. */
  updatedAt: number;
  error?: string;
}

export interface PushBatchResponse {
  results: PushMutationResult[];
  /** Cursor checkpoint the client can pull from afterwards. */
  cursor: string | null;
}

/** Server -> client record envelope for delta download. */
export interface SyncRecordDto {
  tableName: string;
  /** Full row state in camelCase keys (Drizzle's native shape), sync fields included. */
  fields: Record<string, unknown>;
  /** Field -> epoch ms of the last write, camelCase keys. */
  fieldVersions: Record<string, number>;
  revision: number;
  deleted: boolean;
}

export interface PullDeltaResponse {
  records: SyncRecordDto[];
  /** null when more pages remain; pass back as cursor afterwards. */
  nextCursor: string | null;
}
