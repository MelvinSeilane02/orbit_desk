import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Server Component / Server Action helper: the proxy already guards routes,
 * this just gives typed, non-null access to the signed-in user. */
export async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user.id;
}

/** Server Component / Server Action helper: fetches the current user's
 * workspace, redirecting to setup if it doesn't exist yet (belt-and-braces —
 * the proxy already handles this for page navigations). */
export async function requireWorkspace() {
  const userId = await requireUserId();
  const workspace = await prisma.workspace.findUnique({ where: { ownerId: userId } });
  if (!workspace) redirect("/workspace-setup");
  return workspace;
}
