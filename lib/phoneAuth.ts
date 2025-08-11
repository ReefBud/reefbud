// lib/phoneAuth.ts
export function normalizePhone(input: string) {
  const digits = (input || "").replace(/\D/g, "");
  // South Africa default: 0831234567 -> 27831234567
  if (digits.length === 10 && digits.startsWith("0")) {
    return "27" + digits.slice(1);
  }
  return digits;
}
export function phoneToAliasEmail(phoneDigits: string) {
  return `${phoneDigits}@phone.local`;
}
