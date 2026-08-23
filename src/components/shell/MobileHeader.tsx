import Link from "next/link";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

export function MobileHeader() {
  return (
    <div
      className="flex items-center justify-between px-4 md:hidden"
      style={{ height: 50, flex: "none", background: "var(--od-surface)", borderBottom: "1px solid var(--od-rule-2)" }}
    >
      <Link href="/overview" className="od-brand">
        <BrandMark />
        <BrandWordmark />
      </Link>
      <AccountMenu showArchiveLink />
    </div>
  );
}
