"use strict";
/**
 * Webpack loader that swaps out every Clerk `@clerk/nextjs` "use server"
 * entrypoint for a tiny no-op stub. Required for `output: export` builds
 * (Tauri desktop + Cloudflare Pages / Workers static assets): the moment
 * Next.js's RSC compiler classifies a file as a Server Action, it gets
 * registered in `server-reference-manifest.json`, and the export step
 * refuses to continue ("Server Actions are not supported with static
 * export."). Pre-empting the SWC loader keeps the directive out of the
 * graph entirely.
 *
 * The Clerk files this targets (each ships as both `cjs/` and `esm/`):
 *
 *   - dist/{cjs,esm}/app-router/server-actions.js
 *       `invalidateCacheAction` — invalidates the Clerk client cache.
 *   - dist/{cjs,esm}/app-router/keyless-actions.js
 *       Keyless-mode bootstrap. The publishable key is always set in
 *       this app, so these are unreachable in production.
 *   - dist/{cjs,esm}/server/keyless-custom-headers.js
 *       `formatMetadataHeaders`, `collectKeylessMetadata` — read response
 *       headers / collect request metadata. Same keyless-mode rationale,
 *       but the file is NOT under `app-router/`, so it is the silent
 *       offender that catches every prior regex miss.
 *
 * Runtime no-ops are intentional: the surface is small, the calls are
 * network/cookie reads that would fail under static export anyway, and
 * Clerk's documented path is to set a real key when deploying.
 */
module.exports = function clerkServerActionsStubLoader(source) {
  if (
    !/@clerk[\\/]nextjs[\\/]dist[\\/](?:cjs|esm)[\\/](?:app-router[\\/]server-actions|app-router[\\/]keyless-actions|server[\\/]keyless-custom-headers)\.js$/.test(
      this.resourcePath,
    )
  ) {
    return source;
  }
  return [
    '"use strict";',
    "",
    "// Stubbed by web-desktop/scripts/loader-stub.cjs for `output: export`.",
    "// Replaces @clerk/nextjs use-server modules before SWC sees them so",
    "// Next.js does not register Server Actions in the manifest and the",
    "// static export step is allowed to finish. Runtime no-ops are safe:",
    "// this app always sets a publishable key and never reaches keyless.",
    "Object.defineProperty(exports, \"__esModule\", { value: true });",
    "exports.invalidateCacheAction = async () => undefined;",
    "exports.createOrReadKeylessAction = async () => undefined;",
    "exports.detectKeylessEnvDriftAction = async () => undefined;",
    "exports.deleteKeylessAction = async () => undefined;",
    "exports.syncKeylessConfigAction = async () => undefined;",
    "exports.createKeylessModeAction = async () => undefined;",
    "exports.claimKeylessModeAction = async () => undefined;",
    "exports.formatMetadataHeaders = async () => ({});",
    "exports.collectKeylessMetadata = async () => ({});",
    "",
  ].join("\n");
};
module.exports.raw = false;