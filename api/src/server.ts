/**
 * Server bootstrap: open DATABASE_URL, migrate, listen. Deployment target is
 * a plain Node.js host (tech.desktop.md, "Deployment").
 */
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/client.js";
import { migrate } from "./db/migrate.js";

const config = loadConfig();
const db = openDatabase(config.databaseUrl);
migrate(db);

const app = await buildApp({ db, config });

await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`api listening on :${config.port} (db ${config.databaseUrl})`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => {
      db.sqlite.close();
      process.exit(0);
    });
  });
}
