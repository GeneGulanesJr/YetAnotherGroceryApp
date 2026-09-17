import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "YetAnotherGroceryApp",
  description:
    "Analytics, reporting, and data-management surface for YetAnotherGroceryApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ClerkProvider>
          <Providers>
          <AppShell>{children}</AppShell>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}