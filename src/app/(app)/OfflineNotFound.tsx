"use client";

import Link from "next/link";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { useCabinetCounts } from "@/lib/offline/reads";

export function OfflineNotFound() {
  const { workspace } = useOfflineWorkspace();
  const { projectCount, clientCount, archiveCount } = useCabinetCounts(workspace.id);

  return (
    <div className="flex flex-1 items-center px-[30px] py-6" style={{ overflow: "hidden" }}>
      <div className="flex w-full items-center gap-16">
        <div className="flex flex-1 flex-col gap-[18px]" style={{ maxWidth: 520 }}>
          <span className="od-plate">Error 404</span>
          <h2>That drawer isn&apos;t here.</h2>
          <p className="od-muted text-[13.5px] leading-[1.65]">
            The page you asked for doesn&apos;t exist, or the project or client it belonged
            to has been archived. Nothing has been lost — check the archive, or search for
            it by name.
          </p>
          <hr className="od-rule" />
          <div className="flex gap-[10px]">
            <Link href="/projects" className="od-btn od-btn-p">Back to Projects</Link>
            <Link href="/archive" className="od-btn od-btn-s">Open archive</Link>
          </div>
        </div>
        <div className="hidden w-[340px] flex-none flex-col md:flex" style={{ border: "1px solid var(--od-rule-2)", background: "var(--od-surface)" }}>
          <div className="flex items-center justify-between px-[15px] py-[11px]" style={{ borderBottom: "1px solid var(--od-rule)" }}>
            <span className="od-kick">Cabinet</span>
            <span className="text-[10.5px]" style={{ color: "#6d635b" }}>3 drawers</span>
          </div>
          <DrawerLine href="/projects" label="Projects" count={projectCount} />
          <DrawerLine href="/clients" label="Clients" count={clientCount} />
          <DrawerLine href="/archive" label="Archive" count={archiveCount} />
        </div>
      </div>
    </div>
  );
}

function DrawerLine({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href} className="od-drawer" style={{ margin: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
      <span className="od-pull" />
      <span className="font-extrabold text-[13px]" style={{ flex: 1 }}>{label}</span>
      <span className="od-num text-[12px]" style={{ color: "var(--od-muted)" }}>{count}</span>
    </Link>
  );
}
