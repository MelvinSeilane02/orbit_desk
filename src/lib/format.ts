import { differenceInCalendarDays, format, formatDistanceToNowStrict } from "date-fns";

export function formatMoney(amount: number | string, currency = "USD") {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateShort(date: Date | string | number) {
  return format(new Date(date), "d MMM yyyy");
}

export function formatDateMed(date: Date | string | number) {
  return format(new Date(date), "dd MMM");
}

/** "2d ago" / "today" / "3w ago" style relative freshness, matching the screens' copy. */
export function formatRelative(date: Date | string | number) {
  const d = new Date(date);
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function daysAgo(date: Date | string | number) {
  return differenceInCalendarDays(new Date(), new Date(date));
}

/** No "—" fallback baked in, so this stays usable for search filtering too —
 * callers add `|| "—"` at display sites. */
export function formatContactName(firstName: string | null, surname: string | null) {
  return [firstName, surname].filter(Boolean).join(" ").trim();
}
