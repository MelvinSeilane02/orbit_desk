"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

const LINKS = [
  { href: "/overview", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
  { href: "/archive", label: "Archive" },
];

export function TopNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="od-nav od-nav-app">
      <Link href="/overview" className="od-brand" style={{ marginRight: 10 }}>
        <BrandMark />
        <BrandWordmark />
      </Link>
      <div className="flex items-center gap-[22px]" style={{ marginRight: "auto" }}>
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link key={l.href} href={l.href} className={active ? "od-nl-on" : "od-nl"}>
              {l.label}
            </Link>
          );
        })}
        <span className="od-nl-off">
          Money{" "}
          <span className="od-tag" style={{ fontSize: 9, padding: "2px 6px", color: "#6d635b" }}>
            Coming
          </span>
        </span>
        <span className="od-nl-off">
          Analytics{" "}
          <span className="od-tag" style={{ fontSize: 9, padding: "2px 6px", color: "#6d635b" }}>
            Coming
          </span>
        </span>
      </div>
      <button type="button" className="od-kbd" onClick={onOpenSearch}>
        ⌘K
      </button>
      <AccountMenu />
    </nav>
  );
}
