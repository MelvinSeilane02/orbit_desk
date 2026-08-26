import { formatMoney } from "@/lib/format";

/** ISO 4217 code, e.g. "USD". Kept as a plain string (not a union) since
 * workspaces can set any currency string today — see Workspace.currency. */
export type CurrencyCode = string;

/** Bundles an amount with its currency so the two can never drift apart or
 * get passed to the wrong `formatMoney(amount, currency)` slot. Stored
 * internally as integer cents — same rationale as the old
 * dollarsToCents/centsToDollars pair this replaces: avoids float drift, and
 * matches IndexedDB having no decimal type. Multi-currency workspaces are
 * not implemented yet, but every amount already carries its own currency,
 * so adding that later doesn't require touching every call site again. */
export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: CurrencyCode
  ) {}

  static fromCents(cents: number, currency: CurrencyCode): Money {
    return new Money(Math.round(cents), currency);
  }

  static fromDollars(amount: number, currency: CurrencyCode): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money) {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: cannot combine ${this.currency} with ${other.currency}`);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  /** Converts using a manually-entered rate (1 unit of this currency = `rate`
   * units of `toCurrency`) rather than a live FX lookup — see Project.currency
   * / conversionRate in db.ts for where that rate comes from. */
  convert(rate: number, toCurrency: CurrencyCode): Money {
    return new Money(Math.round(this.cents * rate), toCurrency);
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  toDollars(): number {
    return this.cents / 100;
  }

  format(): string {
    return formatMoney(this.toDollars(), this.currency);
  }
}

export function sumMoney(items: Money[], currency: CurrencyCode): Money {
  return items.reduce((total, m) => total.add(m), Money.zero(currency));
}
