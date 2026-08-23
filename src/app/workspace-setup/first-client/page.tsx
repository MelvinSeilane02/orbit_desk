import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { createClientAction } from "@/lib/actions/clients";
import { isOfflineMode } from "@/lib/offline/mode";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

export const metadata: Metadata = { title: "Add your first client — Orbit Desk" };

export default function FirstClientPage() {
  if (isOfflineMode()) redirect("/overview");

  return (
    <div className="od-shell">
      <nav className="od-nav">
        <span className="od-brand">
          <BrandMark />
          <BrandWordmark />
        </span>
        <span className="od-kick" style={{ marginLeft: "auto" }}>
          Step 2 of 3
        </span>
      </nav>
      <div className="flex flex-1 items-center justify-center p-9">
        <div className="flex w-full max-w-[540px] flex-col gap-[18px]">
          <span className="od-plate">Drawer 01 · Clients</span>
          <div className="flex flex-col gap-2">
            <h3>Add your first client</h3>
            <p className="od-muted text-[13.5px]">Just the essentials — the rest whenever.</p>
          </div>
          <div className="od-card p-6">
            <ClientForm action={createClientAction} guided submitLabel="Save client" />
          </div>
          <Link href="/overview" className="od-btn od-btn-g" style={{ alignSelf: "flex-start" }}>
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
