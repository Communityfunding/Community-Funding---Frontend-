/** Default for backend-generated UUID business IDs; matches profile validation. */
export function defaultBusinessUsername(id: string): string {
  const hex = id.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error("Invalid business account identifier");
  }
  // Encode 104 bits as a-p: usernames allow letters/underscores, not UUID digits.
  return "biz_" + Array.from(hex.slice(0, 26), (digit) =>
    String.fromCharCode(97 + parseInt(digit, 16))
  ).join("");
}
