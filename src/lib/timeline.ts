import { prisma } from "@/lib/prisma";

/** Append-only (spec §9): every call here is a new row, never an update. */
export async function logEvent(params: {
  workspaceId: string;
  entityType: "project" | "client";
  entityId: string;
  what: string;
  auto?: boolean;
  actorName?: string;
}) {
  return prisma.timelineEvent.create({
    data: {
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      what: params.what,
      auto: params.auto ?? true,
      actorName: params.actorName,
    },
  });
}

/** A project-level auto-event (stage change, payment) also appears in its
 * client's relationship log, matching the sample data in the screens. */
export async function logProjectEventMirrored(params: {
  workspaceId: string;
  projectId: string;
  clientId: string;
  projectName: string;
  what: string;
  actorName?: string;
}) {
  await Promise.all([
    logEvent({
      workspaceId: params.workspaceId,
      entityType: "project",
      entityId: params.projectId,
      what: params.what,
      actorName: params.actorName,
    }),
    logEvent({
      workspaceId: params.workspaceId,
      entityType: "client",
      entityId: params.clientId,
      what: `${params.what} — ${params.projectName}`,
      actorName: params.actorName,
    }),
  ]);
}
