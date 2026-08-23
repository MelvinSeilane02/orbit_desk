/** IDs never leave the browser in offline mode, so any unique string works —
 * no need to match Prisma's cuid format. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
