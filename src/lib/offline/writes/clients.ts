import { z } from "zod";
import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import { logEvent } from "@/lib/offline/timeline";
import type { OfflineFormState } from "@/lib/offline/writes/auth";

const onboardingStatusEnum = z.enum(["pending", "onboarded", "rejected"]);

const clientSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  primaryContact: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  onboardingStatus: onboardingStatusEnum,
});

function redirectTarget(formData: FormData, fallback: string) {
  const target = formData.get("redirectTo");
  return typeof target === "string" && target.startsWith("/") ? target : fallback;
}

export async function createClient(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
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

  const db = getDb();
  const now = Date.now();
  const client = {
    id: newId(),
    workspaceId,
    companyName: parsed.data.companyName,
    primaryContact: parsed.data.primaryContact || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    onboardingStatus: parsed.data.onboardingStatus,
    createdAt: now,
    updatedAt: now,
  };
  await db.clients.add(client);

  await logEvent({
    workspaceId,
    entityType: "client",
    entityId: client.id,
    what: `${client.companyName} is filed. Nice start.`,
  });

  return { redirectTo: redirectTarget(formData, "/clients") };
}

export async function updateClient(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const clientId = String(formData.get("clientId") ?? "");
  const db = getDb();
  const existing = await db.clients.get(clientId);
  if (!existing || existing.workspaceId !== workspaceId) {
    return { error: "That client no longer exists." };
  }

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

  await db.clients.update(clientId, {
    companyName: parsed.data.companyName,
    primaryContact: parsed.data.primaryContact || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    onboardingStatus: parsed.data.onboardingStatus,
    updatedAt: Date.now(),
  });

  if (parsed.data.onboardingStatus !== existing.onboardingStatus) {
    const label =
      parsed.data.onboardingStatus === "onboarded"
        ? "Onboarding completed"
        : parsed.data.onboardingStatus === "rejected"
          ? "Client rejected"
          : "Onboarding marked pending";
    await logEvent({ workspaceId, entityType: "client", entityId: clientId, what: label });
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note) {
    await logEvent({ workspaceId, entityType: "client", entityId: clientId, what: note, auto: false });
  }

  return { redirectTo: redirectTarget(formData, `/clients/${clientId}`) };
}

export async function addClientNote(workspaceId: string, formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const db = getDb();
  const client = await db.clients.get(clientId);
  if (!client || client.workspaceId !== workspaceId || !note) return;

  await logEvent({ workspaceId, entityType: "client", entityId: clientId, what: note, auto: false });
}

/** Mirrors the ON DELETE RESTRICT on Project.clientId — Postgres enforced
 * this at the FK level; IndexedDB has no FKs, so it's an explicit count
 * check here. */
export async function deleteClient(
  workspaceId: string,
  clientId: string
): Promise<{ error?: string }> {
  const db = getDb();
  const client = await db.clients.get(clientId);
  if (!client || client.workspaceId !== workspaceId) return {};

  const projectCount = await db.projects.where("clientId").equals(clientId).count();
  if (projectCount > 0) return { error: "has-projects" };

  await db.clients.delete(clientId);
  return {};
}
