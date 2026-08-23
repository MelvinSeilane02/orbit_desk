"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  currency: z.string().trim().min(1).max(8),
  timezone: z.string().trim().min(1).max(64),
  logoUrl: z.string().trim().max(2_000_000).optional().nullable(),
});

export type FormState = { error?: string } | undefined;

async function upsertWorkspace(userId: string, data: z.infer<typeof workspaceSchema>) {
  await prisma.workspace.upsert({
    where: { ownerId: userId },
    create: { ownerId: userId, ...data, logoUrl: data.logoUrl || null },
    update: { ...data, logoUrl: data.logoUrl || null },
  });
}

export async function createWorkspaceAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const userId = await requireUserId();

  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    logoUrl: formData.get("logoUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  await upsertWorkspace(userId, parsed.data);
  redirect("/workspace-setup/first-client");
}

export async function skipWorkspaceSetupAction() {
  "use server";
  const userId = await requireUserId();
  await upsertWorkspace(userId, {
    name: "My Workspace",
    currency: "USD",
    timezone: "America/New_York",
    logoUrl: null,
  });
  redirect("/workspace-setup/first-client");
}
