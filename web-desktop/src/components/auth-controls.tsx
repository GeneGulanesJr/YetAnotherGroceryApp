"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

const baseItem =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";

const ghostItem = cn(baseItem, "text-muted-foreground hover:bg-accent hover:text-accent-foreground");

const primaryItem = cn(baseItem, "bg-primary text-primary-foreground hover:bg-primary/90");

export function AuthControls({
  variant = "header",
  className,
}: {
  variant?: "header" | "sidebar";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        variant === "sidebar" && "w-full flex-col items-stretch gap-1",
        className,
      )}
    >
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className={variant === "sidebar" ? ghostItem : cn(ghostItem, "px-3")}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className={primaryItem}>
            Sign up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" showName />
      </SignedIn>
    </div>
  );
}
