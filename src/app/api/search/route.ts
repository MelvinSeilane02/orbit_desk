import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ clients: [], projects: [] }, { status: 401 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ clients: [], projects: [] });

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, companyName: true, onboardingStatus: true },
      orderBy: { companyName: "asc" },
      take: 500,
    }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, stage: true, client: { select: { companyName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  return NextResponse.json({ clients, projects });
}
