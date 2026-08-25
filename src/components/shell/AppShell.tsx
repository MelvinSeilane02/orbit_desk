"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/shell/TopNav";
import { MobileHeader } from "@/components/shell/MobileHeader";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { NewWorkspaceModal } from "@/components/shell/NewWorkspaceModal";
import { SignOutConfirmModal } from "@/components/backup/SignOutConfirmModal";
import { RestoreModal } from "@/components/backup/RestoreModal";
import { isOfflineMode } from "@/lib/offline/mode";
import { WorkspaceProvider, useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Offline mode has no server-side session, so route gating (and the whole
  // sign-in/sign-up flow) happens here instead of in proxy.ts — this is the
  // one place the app shell knows about offline mode at all. Two separate
  // chrome components (rather than one branching internally on a prop) so
  // neither ever calls the offline-only hook conditionally.
  if (isOfflineMode()) {
    return (
      <WorkspaceProvider>
        <OfflineShellChrome>{children}</OfflineShellChrome>
      </WorkspaceProvider>
    );
  }

  return <ShellChrome>{children}</ShellChrome>;
}

function useSearchShortcut() {
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return [searchOpen, setSearchOpen] as const;
}

function ShellChrome({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useSearchShortcut();
  return (
    <div className="od-shell">
      <TopNav onOpenSearch={() => setSearchOpen(true)} />
      <MobileHeader />
      <div className="od-body">{children}</div>
      <MobileTabBar />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function OfflineShellChrome({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useSearchShortcut();
  const { workspace } = useOfflineWorkspace();
  return (
    <div className="od-shell">
      <TopNav onOpenSearch={() => setSearchOpen(true)} />
      <MobileHeader />
      <div className="od-body">{children}</div>
      <MobileTabBar />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} workspaceId={workspace.id} />
      <NewWorkspaceModal />
      <SignOutConfirmModal />
      <RestoreModal />
    </div>
  );
}
