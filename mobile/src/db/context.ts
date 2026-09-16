let currentDeviceId: string | null = null;
let clock: () => Date = () => new Date();

interface RuntimeCrypto {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
}

/**
 * UUID v4 without the `uuid` package: its ESM build dereferences the global
 * `crypto` object, which does not exist in Hermes (Expo Go / release builds).
 * Node 26 takes the randomUUID fast path; Hermes falls back through
 * getRandomValues (when polyfilled) to Math.random — fine for client-side
 * collision-resistant ids.
 */
function uuidV4(): string {
  const runtimeCrypto = (globalThis as { crypto?: RuntimeCrypto }).crypto;
  if (runtimeCrypto?.randomUUID !== undefined) {
    try {
      return runtimeCrypto.randomUUID();
    } catch {
      // Fall through to the byte-based path.
    }
  }

  const bytes = new Uint8Array(16);
  if (runtimeCrypto?.getRandomValues !== undefined) {
    runtimeCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function setDeviceId(deviceId: string): void {
  currentDeviceId = deviceId;
}

export function getDeviceId(): string {
  if (currentDeviceId === null) {
    throw new Error(
      "Device id not initialized. Call setDeviceId() after database bootstrap.",
    );
  }
  return currentDeviceId;
}

export function now(): Date {
  return clock();
}

export function newId(): string {
  return uuidV4();
}

/** Freeze time in tests so sync-column assertions are deterministic. */
export function setClockForTests(impl: () => Date): void {
  clock = impl;
}

export function resetClockForTests(): void {
  clock = () => new Date();
}
