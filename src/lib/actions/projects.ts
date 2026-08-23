"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { logEvent, logProjectEventMirrored } from "@/lib/timeline";
import { formatMoney } from "@/lib/format";

export type FormState = { error?: string } | undefined;

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  clientId: z.string().trim().min(1, "Choose a client"),
  fixedPrice: z.coerce.number().min(0, "Enter a price of 0 or more"),
  stage: z.enum(["pending", "active", "built", "transferred", "completed", "rejected"]).optional(),
});

export async function createProjectAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    clientId: formData.get("clientId"),
    fixedPrice: formData.get("fixedPrice") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the project details." };
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: workspace.id },
  });
  if (!client) return { error: "Choose a valid client." };

  const stageRaw = formData.get("stage");
  const stage = stageRaw === "active" ? "active" : "pending";

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      name: parsed.data.name,
      fixedPrice: parsed.data.fixedPrice,
      stage,
      startedAt: stage === "active" ? new Date() : null,
    },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId: project.id,
    clientId: client.id,
    projectName: project.name,
    what: "Project created",
  });

  revalidatePath("/projects");
  revalidatePath(`/clients/${client.id}`);

  const guided = formData.get("guided");
  if (guided === "1") redirect("/overview");

  redirect(`/projects/${project.id}`);
}

const editProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  fixedPrice: z.coerce.number().min(0, "Enter a price of 0 or more"),
});

export async function updateProjectAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: "That project no longer exists." };

  const parsed = editProjectSchema.safeParse({
    name: formData.get("name"),
    fixedPrice: formData.get("fixedPrice"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the project details." };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { name: parsed.data.name, fixedPrice: parsed.data.fixedPrice },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Collaborators
// ---------------------------------------------------------------------------

export async function addCollaboratorAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project || !name) return;

  await prisma.collaborator.create({ data: { projectId, name, role: role || "Collaborator" } });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeCollaboratorAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return;

  await prisma.collaborator.deleteMany({ where: { id: collaboratorId, projectId } });
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Stage transitions — pending/active are simple; built/transferred/completed
// go through dedicated actions since they carry dates and, for transfer, a
// checklist + warning (spec §5: "warns but does not block").
// ---------------------------------------------------------------------------

export async function setActiveAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: { client: true },
  });
  if (!project || project.stage !== "pending") return;

  await prisma.project.update({
    where: { id: projectId },
    data: { stage: "active", startedAt: project.startedAt ?? new Date() },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Active",
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

const markBuiltSchema = z.object({
  builtAt: z.coerce.date(),
});

export async function markBuiltAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: "That project no longer exists." };

  const parsed = markBuiltSchema.safeParse({ builtAt: formData.get("builtAt") || new Date() });
  if (!parsed.success) return { error: "Enter a valid date." };

  await prisma.project.update({
    where: { id: projectId },
    data: { stage: "built", builtAt: parsed.data.builtAt },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Built",
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

const transferSchema = z.object({
  transferredAt: z.coerce.date(),
  handoverNote: z.string().trim().max(2000).optional(),
});

export async function transferOwnershipAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: "That project no longer exists." };

  const parsed = transferSchema.safeParse({
    transferredAt: formData.get("transferredAt") || new Date(),
    handoverNote: formData.get("handoverNote") || undefined,
  });
  if (!parsed.success) return { error: "Enter a valid date." };

  // Warns but never blocks (spec §5/§9) — outstanding balance is surfaced in
  // the UI before this action runs, not re-checked here as a hard stop.
  await prisma.project.update({
    where: { id: projectId },
    data: { stage: "transferred", transferredAt: parsed.data.transferredAt },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Transferred",
  });

  if (parsed.data.handoverNote) {
    await logEvent({
      workspaceId: workspace.id,
      entityType: "project",
      entityId: projectId,
      what: parsed.data.handoverNote,
      auto: false,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function markCompletedAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project || project.stage !== "transferred") return;

  await prisma.project.update({ where: { id: projectId }, data: { stage: "completed" } });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Stage changed to Completed",
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  date: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
});

export async function recordPaymentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: "That project no longer exists." };

  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    date: formData.get("date") || new Date(),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  }

  await prisma.payment.create({
    data: {
      projectId,
      amount: parsed.data.amount,
      date: parsed.data.date,
      note: parsed.data.note || null,
    },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: `Payment recorded — ${formatMoney(parsed.data.amount, workspace.currency)}`,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Reject / archive / notes
// ---------------------------------------------------------------------------

const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1, "Give a reason").max(1000),
  rejectedBy: z.enum(["you", "client"]),
});

export async function rejectProjectAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return { error: "That project no longer exists." };

  const parsed = rejectSchema.safeParse({
    rejectionReason: formData.get("rejectionReason"),
    rejectedBy: formData.get("rejectedBy"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Give a reason for rejecting this project." };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      stage: "rejected",
      rejectionReason: parsed.data.rejectionReason,
      rejectedBy: parsed.data.rejectedBy,
    },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Project rejected",
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/archive");
  redirect("/archive");
}

export async function archiveProjectAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return;

  await prisma.project.update({ where: { id: projectId }, data: { archivedAt: new Date() } });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Project archived",
  });

  revalidatePath("/projects");
  revalidatePath("/archive");
  redirect("/archive");
}

export async function restoreProjectAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) return;

  await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: null, ...(project.stage === "rejected" ? { stage: "active" } : {}) },
  });

  await logProjectEventMirrored({
    workspaceId: workspace.id,
    projectId,
    clientId: project.clientId,
    projectName: project.name,
    what: "Project restored from archive",
  });

  revalidatePath("/projects");
  revalidatePath("/archive");
  redirect(`/projects/${projectId}`);
}

export async function addProjectNoteAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const projectId = String(formData.get("projectId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project || !note) return;

  await logEvent({
    workspaceId: workspace.id,
    entityType: "project",
    entityId: projectId,
    what: note,
    auto: false,
  });

  revalidatePath(`/projects/${projectId}`);
}
