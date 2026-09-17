"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

import { setApiTokenGetter } from "@/lib/auth-token";

/**
 * Mounted once inside ClerkProvider; hands Clerk's session-token getter to
 * the API clients so analytics and sync fetches carry the user's JWT.
 */
export function ApiAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setApiTokenGetter(() => getToken());
    return () => setApiTokenGetter(null);
  }, [getToken]);

  return null;
}
