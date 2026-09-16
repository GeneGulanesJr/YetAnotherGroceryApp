/**
 * Opaque pull cursors: base64url("sq1:<server_seq>"). The prefix lets an old
 * client cursor fail validation (HTTP 400) instead of silently restarting
 * from zero if the encoding ever changes.
 */

const PREFIX = "sq1";

export function encodeCursor(seq: number): string {
  return Buffer.from(`${PREFIX}:${seq}`, "utf8").toString("base64url");
}

/**
 * Decodes a cursor to its server_seq. Absent/empty cursor -> 0 (from the
 * beginning). Malformed cursors -> null (the route answers 400).
 */
export function decodeCursor(cursor: string | null | undefined): number | null {
  if (cursor === null || cursor === undefined || cursor === "") {
    return 0;
  }
  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const separator = raw.indexOf(":");
  if (separator === -1 || raw.slice(0, separator) !== PREFIX) {
    return null;
  }
  const seq = raw.slice(separator + 1);
  if (!/^\d+$/.test(seq)) {
    return null;
  }
  const value = Number(seq);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
