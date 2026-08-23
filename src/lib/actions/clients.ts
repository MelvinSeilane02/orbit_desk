"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { logEvent } from "@/lib/timeline";

const onboardingStatusEnum = z.enum(["pending", "onboarded", "rejected"]);

const clientSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  primaryContact: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  onboardingStatus: onboardingStatusEnum,
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
    primaryContact: formData.get("primaryContact"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    onboardingStatus: formData.get("onboardingStatus") || "pending",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the client details." };
  }

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      companyName: parsed.data.companyName,
      primaryContact: parsed.data.primaryContact || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      onboardingStatus: parsed.data.onboardingStatus,
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
    primaryContact: formData.get("primaryContact"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    onboardingStatus: formData.get("onboardingStatus"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the client details." };
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      companyName: parsed.data.companyName,
      primaryContact: parsed.data.primaryContact || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      onboardingStatus: parsed.data.onboardingStatus,
    },
  });

  if (parsed.data.onboardingStatus !== existing.onboardingStatus) {
    const label =
      parsed.data.onboardingStatus === "onboarded"
        ? "Onboarding completed"
        : parsed.data.onboardingStatus === "rejected"
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
