import Link from "next/link";
import type { AttentionItem } from "@/lib/attention";
import { archiveProjectAction } from "@/lib/actions/projects";

export function AttentionRow({
  item,
  archiveAction = archiveProjectAction,
}: {
  item: AttentionItem;
  /** Offline pages pass their own Dexie-backed archive function; defaults
   * to the online server action. */
  archiveAction?: (formData: FormData) => void | Promise<void>;
}) {
  const href = item.kind === "onboarding" ? `/clients/${item.clientId}` : `/projects/${item.projectId}`;

  return (
    <div className="od-drawer od-drawer-flag" style={{ margin: 0 }}>
      <span className="od-pull" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="font-extrabold text-[13.5px]">{item.projectName}</span>
        <span className="od-muted text-[11.5px]">
          {item.clientName} — {item.why}
        </span>
      </div>
      {item.kind === "archive" ? (
        <form action={archiveAction}>
          <input type="hidden" name="projectId" value={item.projectId} />
          <button type="submit" className="od-btn" style={{ flex: "none", fontSize: 11.5, padding: "7px 11px" }}>
            {item.action}
          </button>
        </form>
      ) : (
        <Link href={href} className="od-btn" style={{ flex: "none", fontSize: 11.5, padding: "7px 11px" }}>
          {item.action}
        </Link>
      )}
    </div>
  );
}
