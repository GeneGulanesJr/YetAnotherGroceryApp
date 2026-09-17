import path from "node:path";

/** @type {import('next').NextConfig} */

// `APP_TARGET=desktop` produces a static Next.js export that Tauri embeds in
// its webview (and that Cloudflare serves as Workers static assets). The
// default (`web`) keeps the Node.js runtime so Server Components, Route
// Handlers, and SSR are available. See tech.desktop.md for the rationale.
const isDesktop = process.env.APP_TARGET === "desktop";

const stubLoader = path.resolve(
  import.meta.dirname,
  "scripts/loader-stub.cjs",
);

// Every Clerk `@clerk/nextjs` entrypoint that begins with `"use server"`.
// Next.js's RSC compiler classifies each as a Server Action, registers it
// in `server-reference-manifest.json`, and `output: export` aborts. We
// pre-empt the SWC loader with a no-op stub module before the directive is
// ever seen — see scripts/loader-stub.cjs for the file list and rationale.
//
// Path forms (each ships as both `cjs/` and `esm/`):
//   app-router/server-actions.js          — `invalidateCacheAction`
//   app-router/keyless-actions.js         — keyless bootstrap
//   server/keyless-custom-headers.js      — `formatMetadataHeaders`,
//                                            `collectKeylessMetadata`
const clerkUseServerResource =
  /@clerk[\\/]nextjs[\\/]dist[\\/](?:cjs|esm)[\\/](?:app-router[\\/]server-actions|app-router[\\/]keyless-actions|server[\\/]keyless-custom-headers)\.js$/;

const nextConfig = {
  reactStrictMode: true,
  output: isDesktop ? "export" : undefined,
  images: {
    // Static export cannot run the Next.js image optimizer at runtime.
    unoptimized: isDesktop,
  },
  trailingSlash: isDesktop,
  webpack: (config) => {
    if (isDesktop) {
      config.module = config.module ?? { rules: [] };
      config.module.rules = config.module.rules ?? [];
      // `enforce: "pre"` runs our loader before Next.js's swc-loader so the
      // stub source replaces the file BEFORE SWC scans the top-level
      // `"use server"` directive. (Webpack applies rules in reverse order
      // unless enforce is set; pre-loaders run first.)
      config.module.rules.push({
        test: clerkUseServerResource,
        enforce: "pre",
        use: [{ loader: stubLoader }],
      });
    }
    return config;
  },
};

export default nextConfig;