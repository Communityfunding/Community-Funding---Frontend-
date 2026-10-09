const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function clearBackendSession(): void {
  if (typeof window === "undefined") return;
  for (const key of ["cf_backend_token", "cf_synced_email", "cf_synced_image", "cf_synced_clerk_id", "cf_site_admin"]) {
    localStorage.removeItem(key);
  }
}

/** Backend JWT payload exp check (no signature verification). */
export function backendJwtExpired(token: string, skewSeconds = 120): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

export type ClerkLikeUser = {
  id: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
  fullName?: string | null;
  firstName?: string | null;
  imageUrl?: string | null;
};

export async function ensureBackendSession(user: ClerkLikeUser): Promise<boolean> {
  const clerk = (window as Window & { Clerk?: { user?: { id: string } | null; session?: unknown } }).Clerk;
  if (!clerk?.session || clerk.user?.id !== user.id) { clearBackendSession(); return false; }
  const existing = localStorage.getItem("cf_backend_token");
  if (existing && localStorage.getItem("cf_synced_clerk_id") === user.id && !backendJwtExpired(existing)) return true;
  clearBackendSession();
  return syncClerkToBackendToken(user);
}

/** Native-JWT routes need the verified Clerk bridge, not the raw Clerk token. */
export async function getVerifiedBackendToken(user: ClerkLikeUser): Promise<string | null> {
  if (!await ensureBackendSession(user)) return null;
  const clerk = (window as Window & { Clerk?: { user?: { id: string } | null; session?: unknown } }).Clerk;
  if (!clerk?.session || clerk.user?.id !== user.id || localStorage.getItem("cf_synced_clerk_id") !== user.id) {
    clearBackendSession();
    return null;
  }
  return localStorage.getItem("cf_backend_token");
}

/** POST /api/auth/clerk-sync — stores cf_backend_token for API calls. */
export async function syncClerkToBackendToken(user: ClerkLikeUser): Promise<boolean> {
  try {
    const clerk = (window as Window & {
      Clerk?: { user?: { id: string } | null; session?: { getToken: () => Promise<string | null> } | null };
    }).Clerk;
    const session = clerk?.session;
    const clerkToken = await session?.getToken();
    if (!clerkToken) return false;
    if (localStorage.getItem("cf_synced_clerk_id") !== user.id) clearBackendSession();
    const res = await fetch(`${API_URL}/api/auth/clerk-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clerkToken}` },
      body: JSON.stringify({
        clerk_id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || "User",
        image_url: user.imageUrl ?? null,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string };
    // A late network response must not restore credentials after logout or
    // attach one user's backend token to a different Clerk session.
    if (!session || clerk?.session !== session || clerk?.user?.id !== user.id) return false;
    localStorage.setItem("cf_backend_token", data.access_token);
    localStorage.setItem("cf_synced_clerk_id", user.id);
    localStorage.setItem("cf_synced_email", user.primaryEmailAddress?.emailAddress || "");
    localStorage.setItem("cf_synced_image", user.imageUrl || "");
    return true;
  } catch {
    return false;
  }
}
