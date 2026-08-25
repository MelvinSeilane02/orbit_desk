"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { isOfflineMode } from "@/lib/offline/mode";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { switchWorkspace } from "@/lib/offline/writes/workspace";
import { SubmitButton } from "@/components/loading/SubmitButton";
import { OakGrainSweep } from "@/components/loading/OakGrainSweep";
import { useDelayedPending } from "@/lib/loading/useDelayedPending";

export function AccountMenu({ showArchiveLink = false }: { showArchiveLink?: boolean }) {
  if (isOfflineMode()) return <OfflineAccountMenu showArchiveLink={showArchiveLink} />;
  return <OnlineAccountMenu showArchiveLink={showArchiveLink} />;
}

/** `<details>` has no built-in click-away-to-close behavior — closes it
 * when a pointerdown lands outside the element while it's open. */
function useCloseOnClickAway(ref: React.RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref]);
}

function MenuChevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" className="od-acct-chevron" style={{ pointerEvents: "none" }} aria-hidden="true">
      <path d="M1 3L4.5 6.5L8 3" stroke="var(--od-text)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OnlineAccountMenu({ showArchiveLink }: { showArchiveLink: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useCloseOnClickAway(ref);

  return (
    <details ref={ref} className="relative">
      <summary
        className="list-none"
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--od-oak)",
          cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.1)",
        }}
        aria-label="Account menu"
      >
        <MenuChevron />
      </summary>
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
          <SubmitButton className="od-tab w-full text-left" style={{ padding: "10px 14px", color: "var(--od-red)" }}>
            Sign out
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

/** No server session to sign out of — "Sign out" opens SignOutConfirmModal,
 * which offers a backup-first option before clearing the local
 * sessionStorage pointer to the current local user (drops back to the
 * sign-in screen, see WorkspaceProvider). Also carries the workspace
 * switcher, since this is "the account/nav area dropdown" — no separate
 * popover was introduced for it. */
function OfflineAccountMenu({ showArchiveLink }: { showArchiveLink: boolean }) {
  const { user, workspace, workspaces } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ref = useRef<HTMLDetailsElement>(null);
  useCloseOnClickAway(ref);
  const [switching, startSwitch] = useTransition();
  const showSwitchingSweep = useDelayedPending(switching);

  function queryHref(param: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(param, value);
    return `${pathname}?${next.toString()}`;
  }
  const newWorkspaceHref = queryHref("newWorkspace", "1");

  function onSwitch(workspaceId: string) {
    startSwitch(async () => {
      await switchWorkspace(user.id, workspaceId);
      router.push("/overview");
    });
  }

  return (
    <details ref={ref} className="relative">
      <summary
        className="list-none"
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--od-oak)",
          cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.1)",
        }}
        aria-label="Account menu"
      >
        <MenuChevron />
      </summary>
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
              disabled={switching}
              className="od-tab w-full text-left flex items-center gap-[8px]"
              style={{ padding: "8px 14px" }}
            >
              {w.name}
              {showSwitchingSweep && <OakGrainSweep variant="inline" />}
            </button>
          )
        )}
        <Link
          href={newWorkspaceHref}
          className="od-tab"
          style={{ padding: "8px 14px", color: "var(--od-brass)" }}
        >
          + New workspace
        </Link>
        <Link
          href={queryHref("restore", "1")}
          className="od-tab"
          style={{ padding: "8px 14px", borderBottom: "1px solid var(--od-rule)" }}
        >
          Restore workspace
        </Link>

        {showArchiveLink && (
          <Link href="/archive" className="od-tab" style={{ padding: "10px 14px", borderBottom: "1px solid var(--od-rule)" }}>
            Archive
          </Link>
        )}
        <Link
          href={queryHref("signout", "1")}
          className="od-tab"
          style={{ padding: "10px 14px", color: "var(--od-red)" }}
        >
          Sign out
        </Link>
      </div>
    </details>
  );
}
