"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { isOfflineMode } from "@/lib/offline/mode";
import { getDb } from "@/lib/offline/db";

type SearchClient = { id: string; companyName: string; onboardingStatus: string };
type SearchProject = {
  id: string;
  name: string;
  stage: string;
  client: { companyName: string };
};

export function CommandPalette({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Offline mode only — Dexie queries need the current workspace scope. */
  workspaceId?: string;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<SearchClient[]>([]);
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;

    if (isOfflineMode()) {
      if (!workspaceId) return;
      const db = getDb();
      Promise.all([
        db.clients.where("workspaceId").equals(workspaceId).toArray(),
        db.projects.where("workspaceId").equals(workspaceId).toArray(),
      ]).then(([dbClients, dbProjects]) => {
        const clientById = new Map(dbClients.map((c) => [c.id, c]));
        setClients(dbClients.map((c) => ({ id: c.id, companyName: c.companyName, onboardingStatus: c.onboardingStatus })));
        setProjects(
          dbProjects
            .filter((p) => clientById.has(p.clientId))
            .map((p) => ({
              id: p.id,
              name: p.name,
              stage: p.stage,
              client: { companyName: clientById.get(p.clientId)!.companyName },
            }))
        );
        setLoaded(true);
      });
      return;
    }

    fetch("/api/search")
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients ?? []);
        setProjects(data.projects ?? []);
        setLoaded(true);
      })
      .catch(() => {});
  }, [open, loaded, workspaceId]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const buildAwaitingTransfer = projects.filter((p) => p.stage === "built");
  const pendingClients = clients.filter((c) => c.onboardingStatus === "pending");

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Jump to a client, project, or action"
      overlayClassName="od-scrim od-cmdk-overlay"
      contentClassName="od-modal od-modal-md"
    >
      <div className="od-modal-head" style={{ borderBottom: "1px solid var(--od-rule)" }}>
        <Command.Input
          autoFocus
          placeholder="Search clients, projects, actions…"
          className="od-input"
          style={{ border: "none", background: "transparent", padding: 0 }}
        />
      </div>
      <Command.List className="od-modal-body" style={{ maxHeight: "50vh" }}>
        <Command.Empty className="od-muted text-[13px]">Nothing found.</Command.Empty>

        <Command.Group heading="Actions">
          <Command.Item
            className="od-drawer"
            style={{ margin: 0 }}
            onSelect={() => go("/clients?new=1")}
          >
            + New client
          </Command.Item>
          <Command.Item
            className="od-drawer"
            style={{ margin: 0 }}
            onSelect={() => go("/projects?new=1")}
          >
            + New project
          </Command.Item>
          {buildAwaitingTransfer.map((p) => (
            <Command.Item
              key={`transfer-${p.id}`}
              className="od-drawer"
              style={{ margin: 0 }}
              onSelect={() => go(`/projects/${p.id}`)}
            >
              Transfer ownership of {p.name}
            </Command.Item>
          ))}
          {pendingClients.map((c) => (
            <Command.Item
              key={`onboard-${c.id}`}
              className="od-drawer"
              style={{ margin: 0 }}
              onSelect={() => go(`/clients/${c.id}`)}
            >
              Finish onboarding for {c.companyName}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Projects">
          {projects.map((p) => (
            <Command.Item
              key={p.id}
              value={`${p.name} ${p.client.companyName}`}
              className="od-drawer"
              style={{ margin: 0 }}
              onSelect={() => go(`/projects/${p.id}`)}
            >
              <span style={{ flex: 1 }}>{p.name}</span>
              <span className="od-muted text-[12px]">{p.client.companyName}</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Clients">
          {clients.map((c) => (
            <Command.Item
              key={c.id}
              value={c.companyName}
              className="od-drawer"
              style={{ margin: 0 }}
              onSelect={() => go(`/clients/${c.id}`)}
            >
              {c.companyName}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
