import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import { setCurrentUserId, clearCurrentUserId } from "@/lib/offline/session";
import { seedDemoData } from "@/lib/offline/seed";

/** Superset of lib/actions/*'s FormState — the extra optional `redirectTo`
 * lets shared modal/form components navigate after a client-side write
 * resolves, since there's no server-side redirect() to rely on here. Online
 * actions never set it, so this is purely additive. */
export type OfflineFormState = { error?: string; redirectTo?: string } | undefined;

export async function offlineSignUp(
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();

  if (!name) return { error: "Enter your first name." };
  if (!surname) return { error: "Enter your surname." };
  if (!username) return { error: "Choose a username." };

  const db = getDb();
  const existing = await db.users.where("username").equals(username).first();
  if (existing) return { error: "That username is already taken on this device." };

  const workspaceId = newId();
  const user = {
    id: newId(),
    name,
    surname,
    username,
    createdAt: Date.now(),
    lastActiveWorkspaceId: workspaceId,
  };
  await db.users.add(user);

  const workspace = {
    id: workspaceId,
    ownerId: user.id,
    name: `${name}'s Workspace`,
    currency: "USD",
    timezone: "America/New_York",
    logoUrl: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.workspaces.add(workspace);
  await seedDemoData(workspace.id);

  setCurrentUserId(user.id);
  return { redirectTo: "/overview" };
}

export async function offlineSignIn(
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const username = String(formData.get("username") ?? "").trim();
  if (!username) return { error: "Enter your username." };

  const db = getDb();
  const user = await db.users.where("username").equals(username).first();
  if (!user) return { error: "No local profile with that username on this device." };

  setCurrentUserId(user.id);
  return { redirectTo: "/overview" };
}

export function offlineSignOut(): void {
  clearCurrentUserId();
}
