import { v4 as uuidv4 } from "uuid";

let currentDeviceId: string | null = null;
let clock: () => Date = () => new Date();

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
  return uuidv4();
}

/** Freeze time in tests so sync-column assertions are deterministic. */
export function setClockForTests(impl: () => Date): void {
  clock = impl;
}

export function resetClockForTests(): void {
  clock = () => new Date();
}
