/**
 * Collision-resistant ids for server-generated rows (conflict audit entries).
 * Same UUID v4 shape the clients use (`mobile/src/db/context.ts`).
 */

interface RuntimeCrypto {
  randomUUID?: () => string;
}

export function newId(): string {
  const runtimeCrypto = (globalThis as { crypto?: RuntimeCrypto }).crypto;
  if (runtimeCrypto?.randomUUID !== undefined) {
    return runtimeCrypto.randomUUID();
  }
  // Fallback for exotic runtimes without crypto.randomUUID.
  return `svc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
