import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/session";
import { getArchive } from "@/lib/data";
import { formatDateShort } from "@/lib/format";
import { restoreProjectAction } from "@/lib/actions/projects";
import { isOfflineMode } from "@/lib/offline/mode";
import { OfflineArchivePage } from "./OfflineArchivePage";

export const metadata: Metadata = { title: "Archive — Orbit Desk" };

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (isOfflineMode()) return <OfflineArchivePage />;

  const { tab = "rejected" } = await searchParams;
  const workspace = await requireWorkspace();
  const { rejected, archived } = await getArchive(workspace.id);

  const rows = tab === "archived" ? archived : rejected;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-4 px-[30px] pt-6">
        <div className="flex flex-col gap-[6px]">
          <h2>Archive</h2>
          <p className="od-muted max-w-[600px] text-[13px]">
            Work that stopped. Kept, not deleted — the reason is usually worth reading a
            year later.
          </p>
        </div>
        <div className="flex items-end gap-6" style={{ borderBottom: "1px solid var(--od-rule-2)" }}>
          <Link href="/archive?tab=rejected" className={tab === "rejected" ? "od-tab-on" : "od-tab"}>
            Rejected <span className="od-num text-[11px]">{rejected.length}</span>
          </Link>
          <Link href="/archive?tab=archived" className={tab === "archived" ? "od-tab-on" : "od-tab"}>
            Archived <span className="od-num text-[11px]">{archived.length}</span>
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[9px] overflow-y-auto px-[30px] pb-6 pt-4">
        {tab === "rejected" ? (
          <div className="hidden px-4 pb-2 md:flex">
            <span className="od-th" style={{ flex: 1 }}>Project</span>
            <span className="od-th" style={{ width: 170 }}>Client</span>
            <span className="od-th" style={{ flex: 1.2 }}>Reason</span>
            <span className="od-th" style={{ width: 110 }}>Rejected by</span>
            <span className="od-th text-right" style={{ width: 70 }}>When</span>
          </div>
        ) : (
          <div className="hidden px-4 pb-2 md:flex">
            <span className="od-th" style={{ flex: 1 }}>Project</span>
            <span className="od-th" style={{ width: 170 }}>Client</span>
            <span className="od-th text-right" style={{ width: 100 }}>Archived</span>
            <span className="od-th" style={{ width: 90 }} />
          </div>
        )}
        <div>
          {rows.length === 0 && <p className="od-muted p-4 text-[13px]">Nothing here yet.</p>}
          {rows.map((p) =>
            tab === "rejected" ? (
              <div key={p.id} className="od-drawer od-drawer-closed" style={{ padding: "12px 16px" }}>
                <span className="od-pull" />
                <Link href={`/projects/${p.id}`} className="font-extrabold text-[13.5px]" style={{ flex: 1, minWidth: 0 }}>
                  {p.name}
                </Link>
                <span className="od-muted text-[12.5px]" style={{ width: 170 }}>{p.client.companyName}</span>
                <span className="od-muted text-[12.5px]" style={{ flex: 1.2 }}>{p.rejectionReason}</span>
                <span style={{ width: 110 }}>
                  <span className="od-tag od-t-rejected">{p.rejectedBy === "client" ? "Client" : "You"}</span>
                </span>
                <span className="od-muted text-right text-[11.5px]" style={{ width: 70 }}>
                  {formatDateShort(p.updatedAt)}
                </span>
              </div>
            ) : (
              <div key={p.id} className="od-drawer od-drawer-closed" style={{ padding: "12px 16px" }}>
                <span className="od-pull" />
                <Link href={`/projects/${p.id}`} className="font-extrabold text-[13.5px]" style={{ flex: 1, minWidth: 0 }}>
                  {p.name}
                </Link>
                <span className="od-muted text-[12.5px]" style={{ width: 170 }}>{p.client.companyName}</span>
                <span className="od-muted text-right text-[11.5px]" style={{ width: 100 }}>
                  {p.archivedAt ? formatDateShort(p.archivedAt) : "—"}
                </span>
                <form action={restoreProjectAction} style={{ width: 90, textAlign: "right" }}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <button type="submit" className="text-[11.5px] font-extrabold" style={{ color: "var(--od-brass)" }}>
                    Restore
                  </button>
                </form>
              </div>
            )
          )}
        </div>
        {rows.length > 0 && (
          <p className="od-muted pt-2 text-[11.5px]">
            {tab === "rejected"
              ? "Rejected work still counts against a client's history."
              : "Archived projects can be restored back to Active at any time."}
          </p>
        )}
      </div>
    </div>
  );
}
