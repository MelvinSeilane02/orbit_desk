import { z } from "zod";

/** Mirrors ClientRow/ProjectRow/etc. from src/lib/offline/db.ts — kept as a
 * separate schema (not derived from the Dexie types) so a backup file's
 * shape is validated independently of whatever the live schema currently
 * looks like. */

export const backupWorkspaceMetaSchema = z.object({
  name: z.string(),
  currency: z.string(),
  timezone: z.string(),
  logoUrl: z.string().nullable(),
});

export const backupClientSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  companyName: z.string(),
  primaryContactFirstName: z.string().nullable(),
  primaryContactSurname: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  onboardingComplete: z.boolean(),
  onboardingStatus: z.enum(["pending", "onboarded", "rejected"]),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const backupProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  clientId: z.string(),
  name: z.string(),
  fixedPriceCents: z.number(),
  stage: z.enum(["pending", "active", "built", "transferred", "completed", "rejected"]),
  startedAt: z.number().nullable(),
  builtAt: z.number().nullable(),
  transferredAt: z.number().nullable(),
  archivedAt: z.number().nullable(),
  rejectionReason: z.string().nullable(),
  rejectedBy: z.enum(["you", "client"]).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const backupCollaboratorSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  role: z.string(),
});

export const backupPaymentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  amountCents: z.number(),
  date: z.number(),
  note: z.string().nullable(),
});

export const backupTimelineEventSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  entityType: z.enum(["project", "client"]),
  entityId: z.string(),
  what: z.string(),
  auto: z.boolean(),
  actorName: z.string().nullable(),
  when: z.number(),
});

export const backupFileSchema = z.object({
  schemaVersion: z.string(),
  backupType: z.enum(["full", "checkpoint"]),
  exportedAt: z.string(),
  sourceWorkspaceId: z.string(),
  checkpointSince: z.string().nullable(),
  data: z.object({
    workspace: backupWorkspaceMetaSchema,
    clients: z.array(backupClientSchema),
    projects: z.array(backupProjectSchema),
    collaborators: z.array(backupCollaboratorSchema),
    payments: z.array(backupPaymentSchema),
    timelineEvents: z.array(backupTimelineEventSchema),
  }),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

export const CURRENT_SCHEMA_VERSION = "1.0";
