import { SignUp } from "@clerk/nextjs";

/** See sign-in/[[...sign-in]]/page.tsx for the hash-routing rationale. */
const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp routing={isStaticExport ? "hash" : undefined} />
    </div>
  );
}

// The optional catch-all needs at least the base path for `output: export`.
export function generateStaticParams() {
  return [{ "sign-up": [] }];
}
