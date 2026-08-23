"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/overview", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <div
      className="flex md:hidden"
      style={{ background: "var(--od-surface)", borderTop: "1px solid var(--od-rule-2)" }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={active ? "od-mob-tab-on" : "od-mob-tab"}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
