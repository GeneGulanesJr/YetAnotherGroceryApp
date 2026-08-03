/** @type {import('next').NextConfig} */

// `APP_TARGET=desktop` produces a static Next.js export that Tauri embeds in its
// webview. The default (`web`) keeps the Node.js runtime so Server Components,
// Route Handlers, and SSR are available. See tech.desktop.md for the rationale.
const isDesktop = process.env.APP_TARGET === "desktop";

const nextConfig = {
  reactStrictMode: true,
  output: isDesktop ? "export" : undefined,
  images: {
    // Static export cannot run the Next.js image optimizer at runtime.
    unoptimized: isDesktop,
  },
  trailingSlash: isDesktop,
};

export default nextConfig;
