"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { isOfflineMode } from "@/lib/offline/mode";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { switchWorkspace } from "@/lib/offline/writes/workspace";

export function AccountMenu({ showArchiveLink = false }: { showArchiveLink?: boolean }) {
  if (isOfflineMode()) return <OfflineAccountMenu showArchiveLink={showArchiveLink} />;
  return <OnlineAccountMenu showArchiveLink={showArchiveLink} />;
}

function OnlineAccountMenu({ showArchiveLink }: { showArchiveLink: boolean }) {
  return (
    <details className="relative">
      <summary
        className="list-none"
        style={{ width: 30, height: 30, background: "var(--od-oak)", cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,.1)" }}
        aria-label="Account menu"
      />
      <div
        className="absolute right-0 z-20 mt-1 flex flex-col"
        style={{ background: "var(--od-surface)", border: "1px solid var(--od-rule-2)", minWidth: 170, boxShadow: "0 14px 40px rgba(0,0,0,.5)" }}
      >
        {showArchiveLink && (
          <Link href="/archive" className="od-tab" style={{ padding: "10px 14px", borderBottom: "1px solid var(--od-rule)" }}>
            Archive
          </Link>
        )}
        <form action={signOutAction}>
          <button type="submit" className="od-tab w-full text-left" style={{ padding: "10px 14px", color: "var(--od-red)" }}>
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

/** No server session to sign out of — just clears the local sessionStorage
 * pointer to the current local user, which drops back to the sign-in
 * screen (see WorkspaceProvider). Also carries the workspace switcher,
 * since this is "the account/nav area dropdown" — no separate popover was
 * introduced for it. */
function OfflineAccountMenu({ showArchiveLink }: { showArchiveLink: boolean }) {
  const { user, workspace, workspaces, signOut } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const newWorkspaceHref = (() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("newWorkspace", "1");
    return `${pathname}?${next.toString()}`;
  })();

  async function onSwitch(workspaceId: string) {
    await switchWorkspace(user.id, workspaceId);
    router.push("/overview");
  }

  return (
    <details className="relative">
      <summary
        className="list-none"
        style={{ width: 30, height: 30, background: "var(--od-oak)", cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,.1)" }}
        aria-label="Account menu"
      />
      <div
        className="absolute right-0 z-20 mt-1 flex flex-col"
        style={{ background: "var(--od-surface)", border: "1px solid var(--od-rule-2)", minWidth: 190, boxShadow: "0 14px 40px rgba(0,0,0,.5)" }}
      >
        <span className="od-muted text-[11.5px]" style={{ padding: "10px 14px", borderBottom: "1px solid var(--od-rule)" }}>
          {user.name} {user.surname} · offline
        </span>

        <span className="od-muted" style={{ padding: "8px 14px 2px", fontSize: 10, letterSpacing: "0.04em" }}>
          WORKSPACES
        </span>
        {workspaces.map((w) =>
          w.id === workspace.id ? (
            <span key={w.id} className="od-tab" style={{ padding: "8px 14px", fontWeight: 800 }}>
              {w.name} ✓
            </span>
          ) : (
            <button
              key={w.id}
              type="button"
              onClick={() => onSwitch(w.id)}
              className="od-tab w-full text-left"
              style={{ padding: "8px 14px" }}
            >
              {w.name}
            </button>
          )
        )}
        <Link
          href={newWorkspaceHref}
          className="od-tab"
          style={{ padding: "8px 14px", borderBottom: "1px solid var(--od-rule)", color: "var(--od-brass)" }}
        >
          + New workspace
        </Link>

        {showArchiveLink && (
          <Link href="/archive" className="od-tab" style={{ padding: "10px 14px", borderBottom: "1px solid var(--od-rule)" }}>
            Archive
          </Link>
        )}
        <button
          type="button"
          onClick={signOut}
          className="od-tab w-full text-left"
          style={{ padding: "10px 14px", color: "var(--od-red)" }}
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
