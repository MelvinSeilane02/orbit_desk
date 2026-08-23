"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/offline/db";
import type { UserRow, WorkspaceRow } from "@/lib/offline/db";
import { getCurrentUserId, clearCurrentUserId } from "@/lib/offline/session";
import { OfflineAuthScreen } from "@/components/auth/OfflineAuthScreen";

type WorkspaceCtx = {
  user: UserRow;
  workspace: WorkspaceRow;
  workspaces: WorkspaceRow[];
  signOut: () => void;
};

const Ctx = createContext<WorkspaceCtx | null>(null);

export function useOfflineWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOfflineWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/** Offline mode's whole auth+tenancy story: read the current-user id from
 * sessionStorage; if present, look up the user and all their workspaces in
 * Dexie and provide them via context (resolving which one is "current" from
 * the user's `lastActiveWorkspaceId`, falling back to the oldest); if absent
 * (or the reload just happened), render the sign-in/sign-up screen instead
 * of the app shell. This is the client-side replacement for proxy.ts's
 * server-side route gate, since edge middleware can't read
 * sessionStorage/IndexedDB. */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  function refreshSession() {
    setUserId(getCurrentUserId());
  }

  useEffect(() => {
    refreshSession();
  }, []);

  const user = useLiveQuery(async () => {
    if (!userId) return null;
    return (await getDb().users.get(userId)) ?? null;
  }, [userId]);

  const workspaces = useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await getDb().workspaces.where("ownerId").equals(userId).toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }, [userId]);

  // Not yet read sessionStorage.
  if (userId === undefined) return null;

  // Dexie still loading.
  if (user === undefined || workspaces === undefined) return null;

  if (!userId || user === null || workspaces.length === 0) {
    return <OfflineAuthScreen onSignedIn={refreshSession} />;
  }

  const workspace = workspaces.find((w) => w.id === user.lastActiveWorkspaceId) ?? workspaces[0];

  function signOut() {
    clearCurrentUserId();
    refreshSession();
  }

  return <Ctx.Provider value={{ user, workspace, workspaces, signOut }}>{children}</Ctx.Provider>;
}
