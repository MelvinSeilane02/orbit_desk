"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { logEvent } from "@/lib/timeline";

const clientSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  primaryContactFirstName: z.string().trim().max(100).optional().or(z.literal("")),
  primaryContactSurname: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
});

export type FormState = { error?: string } | undefined;

function redirectTarget(formData: FormData, fallback: string) {
  const target = formData.get("redirectTo");
  return typeof target === "string" && target.startsWith("/") ? target : fallback;
}

export async function createClientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();

  const parsed = clientSchema.safeParse({
    companyName: formData.get("companyName"),
    primaryContactFirstName: formData.get("primaryContactFirstName"),
    primaryContactSurname: formData.get("primaryContactSurname"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the client details." };
  }

  // onboardingStatus/onboardingComplete are not accepted here — the
  // fn_clients_set_onboarding DB trigger derives them from contact
  // completeness on insert (see prisma/migrations/20260823000001_*).
  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      companyName: parsed.data.companyName,
      primaryContactFirstName: parsed.data.primaryContactFirstName || null,
      primaryContactSurname: parsed.data.primaryContactSurname || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });

  await logEvent({
    workspaceId: workspace.id,
    entityType: "client",
    entityId: client.id,
    what: `${client.companyName} is filed. Nice start.`,
  });

  const guided = formData.get("guided");
  revalidatePath("/clients");
  if (guided === "1") {
    redirect(`/workspace-setup/first-project?clientId=${client.id}`);
  }
  redirect(redirectTarget(formData, "/clients"));
}

export async function updateClientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const workspace = await requireWorkspace();
  const clientId = String(formData.get("clientId") ?? "");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
  });
  if (!existing) return { error: "That client no longer exists." };

  const parsed = clientSchema.safeParse({
    companyName: formData.get("companyName"),
    primaryContactFirstName: formData.get("primaryContactFirstName"),
    primaryContactSurname: formData.get("primaryContactSurname"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the client details." };
  }

  // onboardingStatus is deliberately omitted from this update payload —
  // leaving the column untouched pre-trigger is what lets a rejected
  // client stay rejected through a normal edit. The trigger recomputes
  // onboardingComplete/onboardingStatus from the fields below regardless.
  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      companyName: parsed.data.companyName,
      primaryContactFirstName: parsed.data.primaryContactFirstName || null,
      primaryContactSurname: parsed.data.primaryContactSurname || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });

  if (updated.onboardingStatus !== existing.onboardingStatus) {
    const label =
      updated.onboardingStatus === "onboarded"
        ? "Onboarding completed"
        : updated.onboardingStatus === "rejected"
          ? "Client rejected"
          : "Onboarding marked pending";
    await logEvent({
      workspaceId: workspace.id,
      entityType: "client",
      entityId: clientId,
      what: label,
    });
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note) {
    await logEvent({
      workspaceId: workspace.id,
      entityType: "client",
      entityId: clientId,
      what: note,
      auto: false,
    });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(redirectTarget(formData, `/clients/${clientId}`));
}

export async function addClientNoteAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const clientId = String(formData.get("clientId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
  });
  if (!client || !note) return;

  await logEvent({
    workspaceId: workspace.id,
    entityType: "client",
    entityId: clientId,
    what: note,
    auto: false,
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const clientId = String(formData.get("clientId") ?? "");

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
    include: { _count: { select: { projects: true } } },
  });
  if (!client) redirect("/clients");

  if (client._count.projects > 0) {
    redirect(`/clients/${clientId}?error=has-projects`);
  }

  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/clients");
  redirect("/clients");
}

/** Rejection is the one part of onboarding status that stays an explicit
 * user action — the trigger only ever auto-toggles pending<->onboarded. */
export async function rejectClientAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const clientId = String(formData.get("clientId") ?? "");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
  });
  if (!existing) return;

  await prisma.client.update({ where: { id: clientId }, data: { onboardingStatus: "rejected" } });
  await logEvent({ workspaceId: workspace.id, entityType: "client", entityId: clientId, what: "Client rejected" });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

/** Moves a rejected client back into the auto-derived pending/onboarded
 * cycle — the trigger immediately recomputes onboarded vs. pending in this
 * same write based on current contact completeness. */
export async function restoreClientAction(formData: FormData) {
  "use server";
  const workspace = await requireWorkspace();
  const clientId = String(formData.get("clientId") ?? "");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
  });
  if (!existing) return;

  await prisma.client.update({ where: { id: clientId }, data: { onboardingStatus: "pending" } });
  await logEvent({ workspaceId: workspace.id, entityType: "client", entityId: clientId, what: "Client restored from rejected" });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}
