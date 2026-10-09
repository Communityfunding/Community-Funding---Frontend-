"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import {
  ensureBackendSession,
  clearBackendSession,
} from "@/lib/backendToken";

export default function AuthSync() {
  const { user, isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { clearBackendSession(); return; }

    const sync = async () => {
      await ensureBackendSession(user);
    };
    sync();
  }, [isLoaded, isSignedIn, user]);

  return null;
}
