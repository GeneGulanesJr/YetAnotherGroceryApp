// Inlined by Expo from .env.local at build time (EXPO_PUBLIC_* convention).
export const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

/** Sign-in is optional: a build without a key runs fully offline, with no account option. */
export const authConfigured = clerkPublishableKey.length > 0;
