import { z } from "zod";
import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import { logEvent, logProjectEventMirrored } from "@/lib/offline/timeline";
import { Money } from "@/lib/money";
import type { OfflineFormState } from "@/lib/offline/writes/auth";
import type { ProjectStage } from "@/lib/offline/db";

function redirectTarget(formData: FormData, fallback: string) {
  const target = formData.get("redirectTo");
  return typeof target === "string" && target.startsWith("/") ? target : fallback;
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  clientId: z.string().trim().min(1, "Choose a client"),
  fixedPrice: z.coerce.number().min(0, "Enter a price of 0 or more"),
});

/** A project can be priced in a currency other than the workspace default —
 * when it is, the user enters a conversion rate by hand (1 unit of the
 * project's currency = `conversionRate` units of the workspace default),
 * which is what totals that span multiple projects convert through instead
 * of calling a live FX API. Defaults to the workspace currency (rate 1)
 * when no currency was chosen. */
function resolveProjectCurrency(
  formData: FormData,
  workspaceCurrency: string
): { currency: string; conversionRate: number } | { error: string } {
  const currencyRaw = formData.get("currency");
  const currency = typeof currencyRaw === "string" && currencyRaw.trim() ? currencyRaw.trim() : workspaceCurrency;

  if (currency === workspaceCurrency) return { currency, conversionRate: 1 };

  const rate = Number(formData.get("conversionRate"));
  if (!Number.isFinite(rate) || rate <= 0) {
    return { error: `Enter a conversion rate — 1 ${currency} = ? ${workspaceCurrency}.` };
  }
  return { currency, conversionRate: rate };
}

export async function createProject(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    clientId: formData.get("clientId"),
    fixedPrice: formData.get("fixedPrice") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the project details." };
  }

  const db = getDb();
  const [client, workspace] = await Promise.all([
    db.clients.get(parsed.data.clientId),
    db.workspaces.get(workspaceId),
  ]);
  if (!client || client.workspaceId !== workspaceId) return { error: "Choose a valid client." };

  const currencyResolution = resolveProjectCurrency(formData, workspace?.currency ?? "USD");
  if ("error" in currencyResolution) return { error: currencyResolution.error };

  // Stage is structurally limited to pending/active on create — there is no
  // way to create a project already `completed`, mirroring the Postgres
  // completion-guard trigger's INSERT-side check by construction.
  const stageRaw = formData.get("stage");
  const stage: ProjectStage = stageRaw === "active" ? "active" : "pending";
  const now = Date.now();

  const project = {
    id: newId(),
    workspaceId,
    clientId: client.id,
    name: parsed.data.name,
    fixedPriceCents: Money.fromDollars(parsed.data.fixedPrice, currencyResolution.currency).cents,
    currency: currencyResolution.currency,
    conversionRate: currencyResolution.conversionRate,
    stage,
    startedAt: stage === "active" ? now : null,
    builtAt: null,
    transferredAt: null,
    archivedAt: null,
    rejectionReason: null,
    rejectedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.add(project);

  await logProjectEventMirrored({
    workspaceId,
    projectId: project.id,
    clientId: client.id,
    projectName: project.name,
    what: "Project created",
  });

  return { redirectTo: `/projects/${project.id}` };
}

const editProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  fixedPrice: z.coerce.number().min(0, "Enter a price of 0 or more"),
});

export async function updateProject(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return { error: "That project no longer exists." };

  const parsed = editProjectSchema.safeParse({
    name: formData.get("name"),
    fixedPrice: formData.get("fixedPrice"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the project details." };

  const workspace = await db.workspaces.get(workspaceId);
  const currencyResolution = resolveProjectCurrency(formData, workspace?.currency ?? "USD");
  if ("error" in currencyResolution) return { error: currencyResolution.error };

  await db.projects.update(projectId, {
    name: parsed.data.name,
    fixedPriceCents: Money.fromDollars(parsed.data.fixedPrice, currencyResolution.currency).cents,
    currency: currencyResolution.currency,
    conversionRate: currencyResolution.conversionRate,
    updatedAt: Date.now(),
  });

  return { redirectTo: `/projects/${projectId}` };
}

// ---------------------------------------------------------------------------
// Collaborators
// ---------------------------------------------------------------------------

export async function addCollaborator(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId || !name) return;

  await db.collaborators.add({ id: newId(), projectId, name, role: role || "Collaborator" });
}

export async function removeCollaborator(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return;

  await db.collaborators.where({ id: collaboratorId, projectId }).delete();
}

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

export async function setActive(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId || project.stage !== "pending") return;

  await db.projects.update(projectId, {
    stage: "active",
    startedAt: project.startedAt ?? Date.now(),
    updatedAt: Date.now(),
  });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Active",
  });
}

const markBuiltSchema = z.object({ builtAt: z.coerce.date() });

export async function markBuilt(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return { error: "That project no longer exists." };

  const parsed = markBuiltSchema.safeParse({ builtAt: formData.get("builtAt") || new Date() });
  if (!parsed.success) return { error: "Enter a valid date." };

  await db.projects.update(projectId, {
    stage: "built",
    builtAt: parsed.data.builtAt.getTime(),
    updatedAt: Date.now(),
  });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Built",
  });

  return { redirectTo: `/projects/${projectId}` };
}

const transferSchema = z.object({
  transferredAt: z.coerce.date(),
  handoverNote: z.string().trim().max(2000).optional(),
});

export async function transferOwnership(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return { error: "That project no longer exists." };

  const parsed = transferSchema.safeParse({
    transferredAt: formData.get("transferredAt") || new Date(),
    handoverNote: formData.get("handoverNote") || undefined,
  });
  if (!parsed.success) return { error: "Enter a valid date." };

  // Warns but never blocks — outstanding balance is surfaced in the UI
  // before this runs, not re-checked here as a hard stop.
  await db.projects.update(projectId, {
    stage: "transferred",
    transferredAt: parsed.data.transferredAt.getTime(),
    updatedAt: Date.now(),
  });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Transferred",
  });

  if (parsed.data.handoverNote) {
    await logEvent({
      workspaceId,
      entityType: "project",
      entityId: projectId,
      what: parsed.data.handoverNote,
      auto: false,
    });
  }

  return { redirectTo: `/projects/${projectId}` };
}

/** Completion-guard: replaces the Postgres BEFORE UPDATE trigger
 * (fn_projects_guard_completion) — a project can only become `completed`
 * from `transferred`. Silent no-op otherwise, matching the online action. */
export async function markCompleted(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId || project.stage !== "transferred") return;

  await db.projects.update(projectId, { stage: "completed", updatedAt: Date.now() });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Completed",
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  date: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
});

export async function recordPayment(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return { error: "That project no longer exists." };

  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    date: formData.get("date") || new Date(),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  }

  // Payments are recorded in the project's own currency, not necessarily
  // the workspace default — see resolveProjectCurrency above.
  const currency = project.currency ?? (await db.workspaces.get(workspaceId))?.currency ?? "USD";
  const amount = Money.fromDollars(parsed.data.amount, currency);
  await db.payments.add({
    id: newId(),
    projectId,
    amountCents: amount.cents,
    date: parsed.data.date.getTime(),
    note: parsed.data.note || null,
  });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: `Payment recorded — ${amount.format()}`,
  });

  return { redirectTo: `/projects/${projectId}` };
}

// ---------------------------------------------------------------------------
// Reject / archive / restore / notes
// ---------------------------------------------------------------------------

const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1, "Give a reason").max(1000),
  rejectedBy: z.enum(["you", "client"]),
});

export async function rejectProject(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return { error: "That project no longer exists." };

  const parsed = rejectSchema.safeParse({
    rejectionReason: formData.get("rejectionReason"),
    rejectedBy: formData.get("rejectedBy"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Give a reason for rejecting this project." };
  }

  await db.projects.update(projectId, {
    stage: "rejected",
    rejectionReason: parsed.data.rejectionReason,
    rejectedBy: parsed.data.rejectedBy,
    updatedAt: Date.now(),
  });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Project rejected",
  });

  return { redirectTo: "/archive" };
}

export async function archiveProject(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return;

  await db.projects.update(projectId, { archivedAt: Date.now(), updatedAt: Date.now() });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Project archived",
  });
}

export async function restoreProject(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId) return;

  await db.projects.update(projectId, {
    archivedAt: null,
    stage: project.stage === "rejected" ? "active" : project.stage,
    updatedAt: Date.now(),
  });

  await logProjectEventMirrored({
    workspaceId,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Project restored from archive",
  });
}

export async function addProjectNote(workspaceId: string, formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project || project.workspaceId !== workspaceId || !note) return;

  await logEvent({ workspaceId, entityType: "project", entityId: projectId, what: note, auto: false });
}

export { redirectTarget };
