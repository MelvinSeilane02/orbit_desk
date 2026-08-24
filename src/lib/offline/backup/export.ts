import { getDb } from "@/lib/offline/db";
import { CURRENT_SCHEMA_VERSION, type BackupFile } from "@/lib/offline/backup/types";

/** Workspace-scoped export. `collaborators`/`payments` carry no `workspaceId`
 * of their own, so they're scoped by joining through this workspace's
 * project ids — same pattern reads.ts's paidTotalsByProject already uses. */
export async function exportWorkspaceBackup(workspaceId: string): Promise<BackupFile> {
  const db = getDb();
  const workspace = await db.workspaces.get(workspaceId);
  if (!workspace) throw new Error("Workspace not found.");

  const [clients, projects, timelineEvents] = await Promise.all([
    db.clients.where("workspaceId").equals(workspaceId).toArray(),
    db.projects.where("workspaceId").equals(workspaceId).toArray(),
    db.timelineEvents.where("workspaceId").equals(workspaceId).toArray(),
  ]);

  const projectIds = projects.map((p) => p.id);
  const [collaborators, payments] = await Promise.all([
    projectIds.length ? db.collaborators.where("projectId").anyOf(projectIds).toArray() : Promise.resolve([]),
    projectIds.length ? db.payments.where("projectId").anyOf(projectIds).toArray() : Promise.resolve([]),
  ]);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    backupType: "full",
    exportedAt: new Date().toISOString(),
    sourceWorkspaceId: workspaceId,
    checkpointSince: null,
    data: {
      workspace: {
        name: workspace.name,
        currency: workspace.currency,
        timezone: workspace.timezone,
        logoUrl: workspace.logoUrl,
      },
      clients,
      projects,
      collaborators,
      payments,
      timelineEvents,
    },
  };
}

export function backupFilename(workspaceName: string, exportedAt: string): string {
  const slug = workspaceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
  const date = exportedAt.slice(0, 10);
  return `orbit-desk-${slug}-${date}.json`;
}
