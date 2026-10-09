export type SignInNextStep = "complete" | "email_code" | "totp" | "secure_flow" | "error";

// Decide from non-sensitive state only; never log an auth resource or credential.
export function signInNextStep(status: string | null, strategies: string[]): SignInNextStep {
  if (status === "complete") return "complete";
  if (status === "needs_second_factor" || status === "needs_client_trust") {
    if (strategies.includes("email_code")) return "email_code";
    if (strategies.includes("totp")) return "totp";
    return "secure_flow";
  }
  if (["needs_new_password", "needs_first_factor", "needs_identifier"].includes(status || "")) {
    return "secure_flow";
  }
  return "error";
}
