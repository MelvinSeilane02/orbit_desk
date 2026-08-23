import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import type { TimelineEntityType } from "@/lib/offline/db";

/** Append-only, mirrors src/lib/timeline.ts: every call is a new row. */
export async function logEvent(params: {
  workspaceId: string;
  entityType: TimelineEntityType;
  entityId: string;
  what: string;
  auto?: boolean;
  actorName?: string | null;
  when?: number;
}) {
  const db = getDb();
  return db.timelineEvents.add({
    id: newId(),
    workspaceId: params.workspaceId,
    entityType: params.entityType,
    entityId: params.entityId,
    what: params.what,
    auto: params.auto ?? true,
    actorName: params.actorName ?? null,
    when: params.when ?? Date.now(),
  });
}

/** A project-level auto-event also mirrors into its client's relationship
 * log, matching the online behavior in src/lib/timeline.ts. */
export async function logProjectEventMirrored(params: {
  workspaceId: string;
  projectId: string;
  clientId: string;
  projectName: string;
  what: string;
  actorName?: string | null;
}) {
  const db = getDb();
  await db.transaction("rw", db.timelineEvents, async () => {
    await logEvent({
      workspaceId: params.workspaceId,
      entityType: "project",
      entityId: params.projectId,
      what: params.what,
      actorName: params.actorName,
    });
    await logEvent({
      workspaceId: params.workspaceId,
      entityType: "client",
      entityId: params.clientId,
      what: `${params.what} — ${params.projectName}`,
      actorName: params.actorName,
    });
  });
}
