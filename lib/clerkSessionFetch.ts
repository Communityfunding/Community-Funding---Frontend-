export async function fetchWithClerkSession(
  getToken: () => Promise<string | null>,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error("Sign in before using organization tools.");
  const headers = new Headers(init?.headers);
  // A cached backend identity must never replace the current Clerk session.
  headers.set("Authorization", `Bearer ${token}`);
  return globalThis.fetch(input, { ...init, headers });
}
