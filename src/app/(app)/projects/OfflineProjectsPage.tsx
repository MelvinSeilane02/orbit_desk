"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { useProjectsForList, useAttentionItems, useClientsPicker, type ProjectListRow } from "@/lib/offline/reads";
import { archiveProject, createProject } from "@/lib/offline/writes/projects";
import { formatMoney, formatRelative } from "@/lib/format";
import { stageTone, StatusTag } from "@/components/ui/StatusTag";
import { AttentionRow } from "@/components/projects/AttentionRow";
import { TruncatedTitle } from "@/components/ui/TruncatedTitle";
import { NewProjectModal } from "@/components/projects/ProjectModals";

const TABS = [
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "built", label: "Built" },
  { key: "transferred", label: "Transferred" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;

export function OfflineProjectsPage() {
  const { workspace } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") ?? "active";
  const view = searchParams.get("view") ?? "list";
  const q = searchParams.get("q") ?? "";
  const clientFilter = searchParams.get("client") ?? "";

  const allRows = useProjectsForList(workspace.id);
  const attention = useAttentionItems(workspace.id);
  const clients = useClientsPicker(workspace.id);

  const live = allRows.filter((p) => p.stage !== "rejected" && !p.archivedAt);
  const counts = {
    active: live.filter((p) => p.stage === "active").length,
    pending: live.filter((p) => p.stage === "pending").length,
    built: live.filter((p) => p.stage === "built").length,
    transferred: live.filter((p) => p.stage === "transferred").length,
    completed: live.filter((p) => p.stage === "completed").length,
    all: live.length,
  };

  const attentionByProject = new Set(attention.map((a) => a.projectId));
  const query = q.trim().toLowerCase();

  let rows = tab === "all" ? live : live.filter((p) => p.stage === tab);
  if (clientFilter) rows = rows.filter((p) => p.clientId === clientFilter);
  if (query) rows = rows.filter((p) => p.name.toLowerCase().includes(query));

  function withParams(next: Record<string, string>) {
    const p = new URLSearchParams({ tab, view, q, client: clientFilter });
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    for (const k of ["tab", "view", "q", "client"]) if (!p.get(k)) p.delete(k);
    return `${pathname}?${p.toString()}`;
  }

  function newProjectHref() {
    const p = new URLSearchParams({ tab, view, q, client: clientFilter });
    for (const k of ["tab", "view", "q", "client"]) if (!p.get(k)) p.delete(k);
    p.set("new", "1");
    return `${pathname}?${p.toString()}`;
  }

  return (
    <>
      <div className="flex flex-none flex-col gap-4 px-[30px] pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2>Projects</h2>
            <span className="od-muted text-[12.5px]">{allRows.length} filed</span>
          </div>
          <div className="flex items-center gap-[10px]">
            <Link href={newProjectHref()} className="od-btn od-btn-p">
              New project
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-6" style={{ borderBottom: "1px solid var(--od-rule-2)" }}>
          {TABS.map((t) => (
            <Link key={t.key} href={withParams({ tab: t.key })} className={tab === t.key ? "od-tab-on" : "od-tab"}>
              {t.label} <span className="od-num text-[11px]">{counts[t.key]}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-[10px]">
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
              placeholder="Search projects"
              className="od-input"
              style={{ width: 220, minHeight: 34, padding: "7px 11px" }}
            />
          </form>
          <ClientFilter clients={clients} value={clientFilter} withParams={withParams} />
          <div className="flex" style={{ marginLeft: "auto", border: "1px solid var(--od-rule-2)" }}>
            <Link
              href={withParams({ view: "list" })}
              className="px-[13px] py-2 text-[12px] font-extrabold"
              style={{ background: view === "list" ? "var(--od-oak)" : undefined, color: view === "list" ? "var(--od-text)" : "var(--od-muted)" }}
            >
              List
            </Link>
            <Link
              href={withParams({ view: "by-client" })}
              className="px-[13px] py-2 text-[12px] font-extrabold"
              style={{
                background: view === "by-client" ? "var(--od-oak)" : undefined,
                color: view === "by-client" ? "var(--od-text)" : "var(--od-muted)",
                borderLeft: "1px solid var(--od-rule-2)",
              }}
            >
              By client
            </Link>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[30px] pb-6 pt-4">
        {attention.length > 0 && (
          <div className="flex flex-col gap-[9px]">
            <div className="flex items-center gap-[11px]">
              <span className="od-plate" style={{ color: "#d78872", borderColor: "rgba(194,85,61,.45)" }}>
                Needs attention · {attention.length}
              </span>
              <span className="od-muted text-[11.5px]">Pinned above the drawer until cleared</span>
            </div>
            <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-x-[14px]">
              {attention.map((a) => (
                <AttentionRow key={a.projectId} item={a} archiveAction={(fd) => archiveProject(workspace.id, fd)} />
              ))}
            </div>
          </div>
        )}

        {view === "by-client" ? (
          <ByClientView rows={rows} currency={workspace.currency} />
        ) : (
          <ListView rows={rows} currency={workspace.currency} attentionByProject={attentionByProject} />
        )}
      </div>

      <NewProjectModal clients={clients} action={(state, fd) => createProject(workspace.id, state, fd)} />
    </>
  );
}

function ListView({
  rows,
  currency,
  attentionByProject,
}: {
  rows: ProjectListRow[];
  currency: string;
  attentionByProject: Set<string>;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-[9px]">
      <span className="od-plate">All work</span>
      <div className="hidden px-4 pb-2 md:flex">
        <span className="od-th" style={{ flex: 1 }}>Project</span>
        <span className="od-th" style={{ width: 180 }}>Client</span>
        <span className="od-th" style={{ width: 120 }}>Stage</span>
        <span className="od-th text-right" style={{ width: 100 }}>Price</span>
        <span className="od-th text-right" style={{ width: 92 }}>Updated</span>
      </div>
      <div>
        {rows.length === 0 && <p className="od-muted p-4 text-[13px]">No projects match this view yet.</p>}
        {rows.map((p) => {
          const { tone, label } = stageTone(p.stage);
          const flagged = attentionByProject.has(p.id);
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className={flagged ? "od-drawer od-drawer-flag" : "od-drawer"} style={{ cursor: "pointer" }}>
              <span className="od-pull" />
              <TruncatedTitle text={p.name} className="font-extrabold text-[13.5px]" style={{ flex: 1, minWidth: 0 }} />
              <span className="od-muted hidden text-[13px] md:inline" style={{ width: 180 }}>{p.client.companyName}</span>
              <span className="md:w-[120px]" style={{ flex: "none" }}>
                <StatusTag tone={tone} label={label} />
              </span>
              <span className="od-num text-right text-[13.5px] md:w-[100px]" style={{ flex: "none" }}>
                {formatMoney(p.fixedPrice, currency)}
              </span>
              <span className="od-muted hidden text-right text-[11.5px] md:inline" style={{ width: 92 }}>
                {formatRelative(p.lastActivity)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ByClientView({ rows, currency }: { rows: ProjectListRow[]; currency: string }) {
  const groups = new Map<string, { client: string; clientId: string; items: ProjectListRow[] }>();
  for (const p of rows) {
    const g = groups.get(p.clientId) ?? { client: p.client.companyName, clientId: p.clientId, items: [] };
    g.items.push(p);
    groups.set(p.clientId, g);
  }
  const list = [...groups.values()].sort((a, b) => a.client.localeCompare(b.client));

  return (
    <div className="flex min-h-0 flex-col gap-5">
      {list.length === 0 && <p className="od-muted p-4 text-[13px]">No projects match this view yet.</p>}
      {list.map((g) => {
        const booked = g.items.reduce((s, p) => s + p.fixedPrice, 0);
        return (
          <div key={g.clientId} className="flex flex-col gap-[9px]">
            <div className="flex items-center gap-3">
              <span className="od-plate">{g.client}</span>
              <span className="od-muted text-[11.5px]">
                {g.items.length} project{g.items.length === 1 ? "" : "s"} · {formatMoney(booked, currency)} booked
              </span>
              <Link href={`/clients/${g.clientId}`} className="text-[11.5px] font-extrabold" style={{ marginLeft: "auto", color: "var(--od-brass)" }}>
                Open client
              </Link>
            </div>
            <div>
              {g.items.map((p) => {
                const { tone, label } = stageTone(p.stage);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="od-drawer" style={{ padding: "11px 14px", cursor: "pointer" }}>
                    <span className="od-pull" />
                    <TruncatedTitle text={p.name} className="text-[13.5px]" style={{ flex: 1, minWidth: 0 }} />
                    <span className="md:w-[120px]" style={{ flex: "none" }}>
                      <StatusTag tone={tone} label={label} />
                    </span>
                    <span className="od-num text-right text-[13.5px] md:w-[100px]" style={{ flex: "none" }}>
                      {formatMoney(p.fixedPrice, currency)}
                    </span>
                    <span className="od-muted hidden text-right text-[11.5px] md:inline" style={{ width: 92 }}>
                      {formatRelative(p.lastActivity)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClientFilter({
  clients,
  value,
  withParams,
}: {
  clients: Array<{ id: string; companyName: string }>;
  value: string;
  withParams: (next: Record<string, string>) => string;
}) {
  return (
    <details className="relative">
      <summary className="od-btn od-btn-s list-none" style={{ padding: "8px 12px" }}>
        {value ? clients.find((c) => c.id === value)?.companyName ?? "Client" : "Client ▾"}
      </summary>
      <div className="absolute z-10 mt-1 flex flex-col" style={{ background: "var(--od-surface)", border: "1px solid var(--od-rule-2)", minWidth: 200, maxHeight: 260, overflowY: "auto" }}>
        <Link href={withParams({ client: "" })} className="od-tab" style={{ padding: "8px 12px", borderBottom: "1px solid var(--od-rule)" }}>
          All clients
        </Link>
        {clients.map((c) => (
          <Link key={c.id} href={withParams({ client: c.id })} className="od-tab" style={{ padding: "8px 12px" }}>
            {c.companyName}
          </Link>
        ))}
      </div>
    </details>
  );
}
