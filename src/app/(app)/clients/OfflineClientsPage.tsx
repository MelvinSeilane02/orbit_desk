"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { useClientsForList, daysAgo, type ClientListRow } from "@/lib/offline/reads";
import { createClient } from "@/lib/offline/writes/clients";
import { formatRelative } from "@/lib/format";
import { onboardingTone, StatusTag } from "@/components/ui/StatusTag";
import { NewClientModal } from "@/components/clients/ClientModals";

const TABS = [
  { key: "all", label: "All" },
  { key: "onboarded", label: "Onboarded" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
] as const;

export function OfflineClientsPage() {
  const { workspace } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") ?? "all";
  const view = searchParams.get("view") ?? "all";
  const q = searchParams.get("q") ?? "";

  const clients = useClientsForList(workspace.id);

  const counts = {
    all: clients.length,
    onboarded: clients.filter((c) => c.onboardingStatus === "onboarded").length,
    pending: clients.filter((c) => c.onboardingStatus === "pending").length,
    rejected: clients.filter((c) => c.onboardingStatus === "rejected").length,
  };

  const query = q.trim().toLowerCase();
  let filtered = clients.filter((c) => (tab === "all" ? true : c.onboardingStatus === tab));
  if (query) {
    filtered = filtered.filter(
      (c) =>
        c.companyName.toLowerCase().includes(query) ||
        (c.primaryContact ?? "").toLowerCase().includes(query)
    );
  }

  function withParams(next: Record<string, string>) {
    const p = new URLSearchParams({ tab, view, q });
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!p.get("q")) p.delete("q");
    return `${pathname}?${p.toString()}`;
  }

  function newClientHref() {
    const p = new URLSearchParams({ tab, view, q });
    if (!p.get("q")) p.delete("q");
    p.set("new", "1");
    return `${pathname}?${p.toString()}`;
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-[30px] pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2>Clients</h2>
            <span className="od-muted text-[12.5px]">
              {counts.all} filed · {counts.pending} pending onboarding
            </span>
          </div>
          <div className="flex items-center gap-[10px]">
            <Link href={newClientHref()} className="od-btn od-btn-p">
              New client
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3" style={{ borderBottom: "1px solid var(--od-rule-2)" }}>
          <div className="flex gap-6">
            {TABS.map((t) => (
              <Link key={t.key} href={withParams({ tab: t.key })} className={tab === t.key ? "od-tab-on" : "od-tab"}>
                {t.label} <span className="od-num text-[11px]">{counts[t.key]}</span>
              </Link>
            ))}
          </div>
          <div className="mb-2 flex" style={{ border: "1px solid var(--od-rule-2)" }}>
            <Link
              href={withParams({ view: "all" })}
              className="px-[13px] py-2 text-[12px] font-extrabold"
              style={{ background: view === "all" ? "var(--od-oak)" : undefined, color: view === "all" ? "var(--od-text)" : "var(--od-muted)" }}
            >
              All
            </Link>
            <Link
              href={withParams({ view: "last-contact" })}
              className="px-[13px] py-2 text-[12px] font-extrabold"
              style={{
                background: view === "last-contact" ? "var(--od-oak)" : undefined,
                color: view === "last-contact" ? "var(--od-text)" : "var(--od-muted)",
                borderLeft: "1px solid var(--od-rule-2)",
              }}
            >
              By last contact
            </Link>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            router.push(withParams({ q: String(value ?? "") }));
          }}
          className="flex items-center gap-[10px]"
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search clients"
            className="od-input"
            style={{ width: 230, minHeight: 32, padding: "6px 11px", fontSize: 12.5 }}
          />
        </form>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[30px] pb-6 pt-4">
        {view === "last-contact" ? (
          <LastContactView clients={filtered} />
        ) : (
          <AllView clients={filtered} />
        )}
      </div>

      <NewClientModal action={(state, fd) => createClient(workspace.id, state, fd)} />
    </>
  );
}

function AllView({ clients }: { clients: ClientListRow[] }) {
  return (
    <>
      <div className="hidden px-4 pb-2 md:flex">
        <span className="od-th" style={{ flex: 1.2 }}>Client</span>
        <span className="od-th" style={{ flex: 1 }}>Primary contact</span>
        <span className="od-th" style={{ width: 160 }}>Work</span>
        <span className="od-th" style={{ width: 130 }}>Onboarding</span>
        <span className="od-th text-right" style={{ width: 130 }}>Last contact</span>
      </div>
      <div>
        {clients.length === 0 && <EmptyRow />}
        {clients.map((c) => (
          <ClientRow key={c.id} client={c} />
        ))}
      </div>
    </>
  );
}

function LastContactView({ clients }: { clients: ClientListRow[] }) {
  const goneQuiet = clients
    .filter((c) => c.activeCount > 0 && daysAgo(c.lastContactAt) > 14)
    .sort((a, b) => daysAgo(b.lastContactAt) - daysAgo(a.lastContactAt));
  const rest = clients
    .filter((c) => !goneQuiet.includes(c))
    .sort((a, b) => daysAgo(b.lastContactAt) - daysAgo(a.lastContactAt));

  return (
    <>
      {goneQuiet.length > 0 && (
        <div className="flex flex-col gap-[9px]">
          <div className="flex items-center gap-[11px]">
            <span className="od-plate" style={{ color: "#e0bc63", borderColor: "rgba(212,165,60,.45)" }}>
              Gone quiet · {goneQuiet.length}
            </span>
            <span className="od-muted text-[11.5px]">No contact in over two weeks, with work in flight</span>
          </div>
          <div>
            {goneQuiet.map((c) => (
              <div key={c.id} className="od-drawer" style={{ borderColor: "rgba(212,165,60,.35)" }}>
                <span className="od-pull" style={{ background: "var(--od-yellow)", opacity: 0.6 }} />
                <span style={{ width: 26, height: 26, flex: "none", background: "var(--od-oak)" }} />
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className="font-extrabold text-[13.5px]">{c.companyName}</span>
                  <span className="od-muted text-[11.5px]">
                    {c.primaryContact || "—"} · no contact in {daysAgo(c.lastContactAt)} days, {c.activeCount} active project{c.activeCount === 1 ? "" : "s"}
                  </span>
                </div>
                <Link href={`/clients/${c.id}?note=1`} className="od-btn" style={{ flex: "none", fontSize: 11.5, padding: "7px 11px" }}>
                  Log a note
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-col gap-[9px]">
        <span className="od-plate">Everyone else</span>
        <div>
          {rest.length === 0 && <EmptyRow />}
          {rest.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="od-drawer" style={{ cursor: "pointer" }}>
              <span className="od-pull" />
              <span style={{ width: 24, height: 24, flex: "none", background: "var(--od-oak)" }} />
              <span className="font-extrabold text-[13.5px]" style={{ flex: 1, minWidth: 0 }}>
                {c.companyName}
              </span>
              <span className="od-muted text-[12.5px]" style={{ width: 170 }}>{c.primaryContact || "—"}</span>
              <span className="od-muted text-[11.5px]" style={{ width: 180 }}>{formatRelative(c.lastContactAt)}</span>
              <span className="od-muted text-[11.5px]" style={{ width: 160 }}>{c.projectCount} project{c.projectCount === 1 ? "" : "s"}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function ClientRow({ client: c }: { client: ClientListRow }) {
  return (
    <Link href={`/clients/${c.id}`} className="od-drawer" style={{ cursor: "pointer" }}>
      <span className="od-pull" />
      <div className="flex min-w-0 items-center gap-[11px]" style={{ flex: 1.2 }}>
        <span style={{ width: 26, height: 26, flex: "none", background: "var(--od-oak)" }} />
        <span className="font-extrabold text-[13.5px]">{c.companyName}</span>
      </div>
      <div className="hidden min-w-0 flex-col md:flex" style={{ flex: 1 }}>
        <span className="text-[12.5px]">{c.primaryContact || "—"}</span>
        <span className="text-[10.5px]" style={{ color: "var(--od-placeholder)" }}>{c.email || ""}</span>
      </div>
      <span className="od-muted hidden text-[11.5px] md:inline" style={{ width: 160 }}>
        {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
      </span>
      <span style={{ width: 130 }}>
        <StatusTag tone={onboardingTone(c.onboardingStatus)} label={capitalize(c.onboardingStatus)} />
      </span>
      <span className="od-muted hidden text-right text-[11.5px] md:inline" style={{ width: 130 }}>
        {formatRelative(c.lastContactAt)}
      </span>
    </Link>
  );
}

function EmptyRow() {
  return <p className="od-muted p-4 text-[13px]">No clients match this view yet.</p>;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
