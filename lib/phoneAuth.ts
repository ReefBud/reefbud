// lib/phoneAuth.ts
export function normalizePhone(input: string) {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return "27" + digits.slice(1);
  }
  return digits;
}
export function phoneToAliasEmail(phoneDigits: string) {
  // Use a valid reserved domain to avoid TLD validation issues
  return `${phoneDigits}@example.com`;
}
