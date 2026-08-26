import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import type { OfflineFormState } from "@/lib/offline/writes/auth";

/** Extra workspaces (beyond the one created at sign-up) start empty — no
 * seedDemoData call — per the user's explicit decision. */
export async function createWorkspace(
  ownerId: string,
  _prev: OfflineFormState,
  formData: FormData
): Promise<OfflineFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a workspace name." };

  const db = getDb();
  const now = Date.now();
  const workspace = {
    id: newId(),
    ownerId,
    name,
    currency: "USD",
    timezone: "America/New_York",
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.workspaces.add(workspace);
  await db.users.update(ownerId, { lastActiveWorkspaceId: workspace.id });

  return { redirectTo: "/overview" };
}

/** Plain function, not a form action — called directly from an onClick in
 * the workspace switcher. */
export async function switchWorkspace(userId: string, workspaceId: string): Promise<void> {
  await getDb().users.update(userId, { lastActiveWorkspaceId: workspaceId });
}

/** Plain function, not a form action — called directly from the account
 * menu's currency <select>. Only changes which currency new projects
 * default to and which currency multi-project totals are converted into;
 * existing projects keep the currency/conversionRate they were given. */
export async function updateWorkspaceCurrency(workspaceId: string, currency: string): Promise<void> {
  await getDb().workspaces.update(workspaceId, { currency, updatedAt: Date.now() });
}
