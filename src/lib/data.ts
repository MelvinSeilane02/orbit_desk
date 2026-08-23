import { prisma } from "@/lib/prisma";
import { computeAttention, type AttentionItem } from "@/lib/attention";
import { daysAgo } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function latestEventByEntity(
  workspaceId: string,
  entityType: "project" | "client"
) {
  const events = await prisma.timelineEvent.findMany({
    where: { workspaceId, entityType },
    orderBy: { when: "desc" },
    select: { entityId: true, when: true },
  });
  const map = new Map<string, Date>();
  for (const e of events) {
    if (!map.has(e.entityId)) map.set(e.entityId, e.when);
  }
  return map;
}

function toNumber(d: Prisma.Decimal | null | undefined) {
  return d ? Number(d) : 0;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getAllProjectsWithClient(workspaceId: string) {
  return prisma.project.findMany({
    where: { workspaceId },
    include: { client: true, payments: true },
    orderBy: { updatedAt: "desc" },
  });
}

export type ProjectRow = Awaited<ReturnType<typeof getAllProjectsWithClient>>[number] & {
  paidTotal: number;
  outstanding: number;
  lastActivity: Date;
};

export async function getProjectsForList(workspaceId: string) {
  const [projects, lastActivity] = await Promise.all([
    getAllProjectsWithClient(workspaceId),
    latestEventByEntity(workspaceId, "project"),
  ]);

  const rows: ProjectRow[] = projects.map((p) => {
    const paidTotal = p.payments.reduce((sum, pay) => sum + toNumber(pay.amount), 0);
    return {
      ...p,
      paidTotal,
      outstanding: toNumber(p.fixedPrice) - paidTotal,
      lastActivity: lastActivity.get(p.id) ?? p.updatedAt,
    };
  });

  return rows;
}

export async function getAttentionItems(workspaceId: string): Promise<AttentionItem[]> {
  const [projects, lastActivity] = await Promise.all([
    getAllProjectsWithClient(workspaceId),
    latestEventByEntity(workspaceId, "project"),
  ]);
  return computeAttention(projects, lastActivity);
}

export async function getProjectDetail(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      client: true,
      collaborators: true,
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!project) return null;

  const timeline = await prisma.timelineEvent.findMany({
    where: { workspaceId, entityType: "project", entityId: projectId },
    orderBy: { when: "desc" },
  });

  const paidTotal = project.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);

  return {
    project,
    timeline,
    paidTotal,
    outstanding: toNumber(project.fixedPrice) - paidTotal,
  };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function getClientsForList(workspaceId: string) {
  const [clients, lastContact, projects] = await Promise.all([
    prisma.client.findMany({ where: { workspaceId }, orderBy: { companyName: "asc" } }),
    latestEventByEntity(workspaceId, "client"),
    prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, clientId: true, stage: true, fixedPrice: true, payments: true },
    }),
  ]);

  const byClient = new Map<string, typeof projects>();
  for (const p of projects) {
    const list = byClient.get(p.clientId) ?? [];
    list.push(p);
    byClient.set(p.clientId, list);
  }

  return clients.map((c) => {
    const clientProjects = byClient.get(c.id) ?? [];
    const activeCount = clientProjects.filter((p) =>
      ["pending", "active", "built", "transferred"].includes(p.stage)
    ).length;
    const bookedTotal = clientProjects.reduce((sum, p) => sum + toNumber(p.fixedPrice), 0);
    const outstandingTotal = clientProjects.reduce((sum, p) => {
      const paid = p.payments.reduce((s, pay) => s + toNumber(pay.amount), 0);
      return sum + (toNumber(p.fixedPrice) - paid);
    }, 0);

    return {
      ...c,
      projectCount: clientProjects.length,
      activeCount,
      bookedTotal,
      outstandingTotal,
      lastContactAt: lastContact.get(c.id) ?? c.createdAt,
    };
  });
}

export type ClientRow = Awaited<ReturnType<typeof getClientsForList>>[number];

export async function getClientDetail(workspaceId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, workspaceId } });
  if (!client) return null;

  const [projects, timeline] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, clientId },
      include: { payments: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.timelineEvent.findMany({
      where: { workspaceId, entityType: "client", entityId: clientId },
      orderBy: { when: "desc" },
    }),
  ]);

  const bookedTotal = projects.reduce((sum, p) => sum + toNumber(p.fixedPrice), 0);
  const outstandingTotal = projects.reduce((sum, p) => {
    const paid = p.payments.reduce((s, pay) => s + toNumber(pay.amount), 0);
    return sum + (toNumber(p.fixedPrice) - paid);
  }, 0);

  return { client, projects, timeline, bookedTotal, outstandingTotal };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getOverviewCounts(workspaceId: string) {
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      select: { stage: true, archivedAt: true, client: { select: { onboardingStatus: true } } },
    }),
    prisma.client.findMany({ where: { workspaceId }, select: { onboardingStatus: true } }),
  ]);

  const live = projects.filter((p) => p.stage !== "rejected" && !p.archivedAt);

  return {
    active: live.filter((p) => p.stage === "active").length,
    built: live.filter((p) => p.stage === "built").length,
    onboarding: clients.filter((c) => c.onboardingStatus === "pending").length,
    rejected: live.filter((p) => p.client.onboardingStatus === "rejected").length,
  };
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export async function getArchive(workspaceId: string) {
  const [rejected, archived] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, stage: "rejected" },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { workspaceId, archivedAt: { not: null }, stage: { not: "rejected" } },
      include: { client: true },
      orderBy: { archivedAt: "desc" },
    }),
  ]);
  return { rejected, archived };
}

export { daysAgo };
