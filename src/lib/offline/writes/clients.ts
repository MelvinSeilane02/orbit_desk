import { z } from "zod";
import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import { logEvent } from "@/lib/offline/timeline";
import type { OfflineFormState } from "@/lib/offline/writes/auth";
import type { OnboardingStatus } from "@/lib/offline/db";

const clientSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  primaryContactFirstName: z.string().trim().max(100).optional().or(z.literal("")),
  primaryContactSurname: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
});

function redirectTarget(formData: FormData, fallback: string) {
  const target = formData.get("redirectTo");
  return typeof target === "string" && target.startsWith("/") ? target : fallback;
}

/** IndexedDB has no triggers — this is the explicit reimplementation of the
 * online fn_clients_set_onboarding trigger, same pattern as markCompleted()
 * in writes/projects.ts reimplementing the completion-guard. A client is
 * "complete" once first name, surname, and email are all present and
 * non-blank. A `rejected` status is exempt and never auto-overridden. */
export function computeOnboardingComplete(client: {
  primaryContactFirstName: string | null;
  primaryContactSurname: string | null;
  email: string | null;
  onboardingStatus: OnboardingStatus;
}): { onboardingComplete: boolean; onboardingStatus: OnboardingStatus } {
  const onboardingComplete = Boolean(
    client.primaryContactFirstName?.trim() &&
      client.primaryContactSurname?.trim() &&
      client.email?.trim()
  );

  if (client.onboardingStatus === "rejected") {
    return { onboardingComplete, onboardingStatus: "rejected" };
  }
  return { onboardingComplete, onboardingStatus: onboardingComplete ? "onboarded" : "pending" };
}

export async function createClient(
  workspaceId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
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

  const db = getDb();
  const now = Date.now();
  const primaryContactFirstName = parsed.data.primaryContactFirstName || null;
  const primaryContactSurname = parsed.data.primaryContactSurname || null;
  const email = parsed.data.email || null;
  const { onboardingComplete, onboardingStatus } = computeOnboardingComplete({
    primaryContactFirstName,
    primaryContactSurname,
    email,
    onboardingStatus: "pending",
  });

  const client = {
    id: newId(),
    workspaceId,
    companyName: parsed.data.companyName,
    primaryContactFirstName,
    primaryContactSurname,
    email,
    phone: parsed.data.phone || null,
    onboardingComplete,
    onboardingStatus,
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
    primaryContactFirstName: formData.get("primaryContactFirstName"),
    primaryContactSurname: formData.get("primaryContactSurname"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the client details." };
  }

  const primaryContactFirstName = parsed.data.primaryContactFirstName || null;
  const primaryContactSurname = parsed.data.primaryContactSurname || null;
  const email = parsed.data.email || null;
  const { onboardingComplete, onboardingStatus } = computeOnboardingComplete({
    primaryContactFirstName,
    primaryContactSurname,
    email,
    onboardingStatus: existing.onboardingStatus,
  });

  await db.clients.update(clientId, {
    companyName: parsed.data.companyName,
    primaryContactFirstName,
    primaryContactSurname,
    email,
    phone: parsed.data.phone || null,
    onboardingComplete,
    onboardingStatus,
    updatedAt: Date.now(),
  });

  if (onboardingStatus !== existing.onboardingStatus) {
    const label =
      onboardingStatus === "onboarded"
        ? "Onboarding completed"
        : onboardingStatus === "rejected"
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

/** Rejection stays an explicit user action — computeOnboardingComplete only
 * ever auto-toggles pending<->onboarded. */
export async function rejectClient(workspaceId: string, formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const db = getDb();
  const client = await db.clients.get(clientId);
  if (!client || client.workspaceId !== workspaceId) return;

  await db.clients.update(clientId, { onboardingStatus: "rejected", updatedAt: Date.now() });
  await logEvent({ workspaceId, entityType: "client", entityId: clientId, what: "Client rejected" });
}

/** Moves a rejected client back into the auto-derived pending/onboarded
 * cycle — recomputes immediately based on current contact completeness,
 * since there's no trigger to do that implicitly the way Postgres does. */
export async function restoreClient(workspaceId: string, formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const db = getDb();
  const client = await db.clients.get(clientId);
  if (!client || client.workspaceId !== workspaceId) return;

  const { onboardingComplete, onboardingStatus } = computeOnboardingComplete({
    primaryContactFirstName: client.primaryContactFirstName,
    primaryContactSurname: client.primaryContactSurname,
    email: client.email,
    onboardingStatus: "pending",
  });

  await db.clients.update(clientId, { onboardingComplete, onboardingStatus, updatedAt: Date.now() });
  await logEvent({ workspaceId, entityType: "client", entityId: clientId, what: "Client restored from rejected" });
}
