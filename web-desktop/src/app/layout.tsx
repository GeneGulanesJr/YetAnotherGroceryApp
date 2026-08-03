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
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
