/** IndexedDB has no decimal type — money is stored as integer cents and only
 * converted to a dollar `number` at the read/write boundary, matching the
 * `number` shape the UI already gets from `Number(prisma.Decimal)` online. */
export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}
