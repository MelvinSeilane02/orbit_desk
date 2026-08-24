import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import { computeOnboardingComplete } from "@/lib/offline/writes/clients";
import { backupFileSchema, CURRENT_SCHEMA_VERSION, type BackupFile } from "@/lib/offline/backup/types";

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Shape-validates the file (Zod), then checks internal referential
 * consistency — every id one table points at actually exists in the
 * backup's own data. Rejects the whole file rather than trying to salvage
 * a partially-broken one. */
export function parseBackupFile(raw: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  const parsed = backupFileSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "That file doesn't look like an Orbit Desk backup." };
  }
  const backup = parsed.data;

  if (backup.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported backup version (${backup.schemaVersion}).` };
  }
  if (backup.backupType !== "full") {
    return { ok: false, error: "Only full backups can be restored right now." };
  }

  const clientIds = new Set(backup.data.clients.map((c) => c.id));
  const projectIds = new Set(backup.data.projects.map((p) => p.id));

  for (const p of backup.data.projects) {
    if (!clientIds.has(p.clientId)) {
      return { ok: false, error: "Backup file is inconsistent — a project references a client that isn't in the file." };
    }
  }
  for (const c of backup.data.collaborators) {
    if (!projectIds.has(c.projectId)) {
      return { ok: false, error: "Backup file is inconsistent — a collaborator references a project that isn't in the file." };
    }
  }
  for (const p of backup.data.payments) {
    if (!projectIds.has(p.projectId)) {
      return { ok: false, error: "Backup file is inconsistent — a payment references a project that isn't in the file." };
    }
  }
  for (const t of backup.data.timelineEvents) {
    const exists = t.entityType === "project" ? projectIds.has(t.entityId) : clientIds.has(t.entityId);
    if (!exists) {
      return { ok: false, error: "Backup file is inconsistent — a timeline event references a record that isn't in the file." };
    }
  }

  return { ok: true, backup };
}

/** Full Replace: wipes the target workspace's clients/projects/collaborators
 * /payments/timelineEvents and bulk-puts the backup's records in their
 * place, inside one transaction. The workspace record itself is never
 * deleted — only its display metadata is updated — since it's the
 * container being restored into, not a scoped table. Ids are kept exactly
 * as they appear in the backup (collisions across devices are practically
 * impossible with crypto.randomUUID()), so referential integrity between
 * clients/projects/collaborators/payments carries over automatically —
 * only `workspaceId` needs rewriting. Onboarding fields are recomputed
 * from firstName/surname/email as the last step, never taken verbatim. */
export async function restoreWorkspaceBackup(targetWorkspaceId: string, backup: BackupFile): Promise<void> {
  const db = getDb();

  await db.transaction(
    "rw",
    [db.workspaces, db.clients, db.projects, db.collaborators, db.payments, db.timelineEvents],
    async () => {
      const workspace = await db.workspaces.get(targetWorkspaceId);
      if (!workspace) throw new Error("Target workspace not found.");

      await db.workspaces.update(targetWorkspaceId, {
        name: backup.data.workspace.name,
        currency: backup.data.workspace.currency,
        timezone: backup.data.workspace.timezone,
        logoUrl: backup.data.workspace.logoUrl,
        updatedAt: Date.now(),
      });

      const currentProjectIds = await db.projects.where("workspaceId").equals(targetWorkspaceId).primaryKeys();
      if (currentProjectIds.length) {
        await db.collaborators.where("projectId").anyOf(currentProjectIds).delete();
        await db.payments.where("projectId").anyOf(currentProjectIds).delete();
      }
      await db.clients.where("workspaceId").equals(targetWorkspaceId).delete();
      await db.projects.where("workspaceId").equals(targetWorkspaceId).delete();
      await db.timelineEvents.where("workspaceId").equals(targetWorkspaceId).delete();

      const clients = backup.data.clients.map((c) => {
        const { onboardingComplete, onboardingStatus } = computeOnboardingComplete({
          primaryContactFirstName: c.primaryContactFirstName,
          primaryContactSurname: c.primaryContactSurname,
          email: c.email,
          onboardingStatus: c.onboardingStatus,
        });
        return { ...c, workspaceId: targetWorkspaceId, onboardingComplete, onboardingStatus };
      });
      const projects = backup.data.projects.map((p) => ({ ...p, workspaceId: targetWorkspaceId }));
      const timelineEvents = backup.data.timelineEvents.map((t) => ({ ...t, workspaceId: targetWorkspaceId }));

      await db.clients.bulkPut(clients);
      await db.projects.bulkPut(projects);
      await db.collaborators.bulkPut(backup.data.collaborators);
      await db.payments.bulkPut(backup.data.payments);
      await db.timelineEvents.bulkPut(timelineEvents);
    }
  );
}

/** Restoring "as a new workspace" — create one seeded with the backup's own
 * metadata, then restore into it. The delete step inside
 * restoreWorkspaceBackup is a no-op on a workspace with no data yet. */
export async function createWorkspaceFromBackup(ownerId: string, backup: BackupFile): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  await db.workspaces.add({
    id,
    ownerId,
    name: backup.data.workspace.name,
    currency: backup.data.workspace.currency,
    timezone: backup.data.workspace.timezone,
    logoUrl: backup.data.workspace.logoUrl,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
