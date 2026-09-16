/** Environment-driven configuration (see .env.example). */
export interface Config {
  port: number;
  databaseUrl: string;
  /** CORS allow-origin value; empty string allows all origins (development). */
  allowedOrigin: string;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: intEnv("PORT", 8787),
    databaseUrl: env.DATABASE_URL ?? "file:local.db",
    allowedOrigin: env.ALLOWED_ORIGIN ?? "",
  };
}
