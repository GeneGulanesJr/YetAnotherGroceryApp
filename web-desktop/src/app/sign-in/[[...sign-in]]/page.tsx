import { SignIn } from "@clerk/nextjs";

/**
 * Static-export builds (Tauri desktop, Cloudflare) cannot serve Clerk's
 * path-based sub-routes (/sign-in/factor-two, ...), so those builds switch
 * the component to hash routing via NEXT_PUBLIC_STATIC_EXPORT. The SSR web
 * build keeps default path routing.
 */
const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn routing={isStaticExport ? "hash" : undefined} />
    </div>
  );
}

// The optional catch-all needs at least the base path for `output: export`.
export function generateStaticParams() {
  return [{ "sign-in": [] }];
}
