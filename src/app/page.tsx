import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOfflineMode } from "@/lib/offline/mode";

export default async function RootPage() {
  if (isOfflineMode()) redirect("/overview");

  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await prisma.workspace.findUnique({ where: { ownerId: session.user.id } });
  redirect(workspace ? "/overview" : "/workspace-setup");
}
