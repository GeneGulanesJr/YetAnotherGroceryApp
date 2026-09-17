import { useEffect } from "react";
import { useSession } from "@clerk/expo";

import { setSyncAuthToken } from "../sync/transport";

/**
 * Hands the Clerk session JWT to the sync transport (which runs outside
 * React, including from background tasks): whenever the session changes the
 * latest token is pushed into `setSyncAuthToken`; sign-out clears it so the
 * next sync attempt fails auth instead of leaking unauthenticated pushes.
 */
export function SyncAuthBridge() {
  const { isLoaded, session } = useSession();

  useEffect(() => {
    if (!isLoaded || !session) {
      return;
    }
    let cancelled = false;
    void session
      .getToken()
      .then((token) => {
        if (!cancelled) {
          setSyncAuthToken(token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSyncAuthToken(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, session]);

  return null;
}
