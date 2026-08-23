"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/offline/db";
import { centsToDollars } from "@/lib/offline/money";
import { computeAttention, type AttentionItem } from "@/lib/attention";
import type { ClientRow, ProjectRow, TimelineEventRow } from "@/lib/offline/db";

async function latestEventByEntity(workspaceId: string, entityType: "project" | "client") {
  const db = getDb();
  const events = await db.timelineEvents.where("workspaceId").equals(workspaceId).toArray();
  const map = new Map<string, number>();
  for (const e of events) {
    if (e.entityType !== entityType) continue;
    const cur = map.get(e.entityId);
    if (cur === undefined || e.when > cur) map.set(e.entityId, e.when);
  }
  return map;
}

export type ProjectWithClient = ProjectRow & { client: ClientRow };

async function allProjectsWithClient(workspaceId: string): Promise<ProjectWithClient[]> {
  const db = getDb();
  const [projects, clients] = await Promise.all([
    db.projects.where("workspaceId").equals(workspaceId).toArray(),
    db.clients.where("workspaceId").equals(workspaceId).toArray(),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  return projects
    .map((p) => ({ ...p, client: clientById.get(p.clientId) as ClientRow }))
    .filter((p) => p.client)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function paidTotalsByProject(projectIds: string[]) {
  const db = getDb();
  const payments = projectIds.length
    ? await db.payments.where("projectId").anyOf(projectIds).toArray()
    : [];
  const totals = new Map<string, number>();
  for (const pay of payments) {
    totals.set(pay.projectId, (totals.get(pay.projectId) ?? 0) + centsToDollars(pay.amountCents));
  }
  return totals;
}

export type ProjectListRow = ProjectWithClient & {
  fixedPrice: number;
  paidTotal: number;
  outstanding: number;
  lastActivity: number;
};

export function useProjectsForList(workspaceId: string | undefined): ProjectListRow[] {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return [];
      const projects = await allProjectsWithClient(workspaceId);
      const [lastActivity, paidTotals] = await Promise.all([
        latestEventByEntity(workspaceId, "project"),
        paidTotalsByProject(projects.map((p) => p.id)),
      ]);
      return projects.map((p) => {
        const fixedPrice = centsToDollars(p.fixedPriceCents);
        const paidTotal = paidTotals.get(p.id) ?? 0;
        return {
          ...p,
          fixedPrice,
          paidTotal,
          outstanding: fixedPrice - paidTotal,
          lastActivity: lastActivity.get(p.id) ?? p.updatedAt,
        };
      });
    }, [workspaceId]) ?? []
  );
}

export function useAttentionItems(workspaceId: string | undefined): AttentionItem[] {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return [];
      const projects = await allProjectsWithClient(workspaceId);
      const lastActivity = await latestEventByEntity(workspaceId, "project");
      return computeAttention(projects, lastActivity);
    }, [workspaceId]) ?? []
  );
}

export type ProjectDetail = {
  project: ProjectWithClient & {
    collaborators: { id: string; name: string; role: string }[];
    fixedPrice: number;
  };
  payments: { id: string; amount: number; date: number; note: string | null }[];
  timeline: TimelineEventRow[];
  paidTotal: number;
  outstanding: number;
} | null;

export function useProjectDetail(
  workspaceId: string | undefined,
  projectId: string | undefined
): ProjectDetail | undefined {
  return useLiveQuery(async () => {
    if (!workspaceId || !projectId) return null;
    const db = getDb();
    const project = await db.projects.get(projectId);
    if (!project || project.workspaceId !== workspaceId) return null;

    const [client, collaborators, payments, timeline] = await Promise.all([
      db.clients.get(project.clientId),
      db.collaborators.where("projectId").equals(projectId).toArray(),
      db.payments.where("projectId").equals(projectId).sortBy("date"),
      db.timelineEvents.where("workspaceId").equals(workspaceId).toArray(),
    ]);
    if (!client) return null;

    const projectTimeline = timeline
      .filter((t) => t.entityType === "project" && t.entityId === projectId)
      .sort((a, b) => b.when - a.when);

    const paymentsDollars = payments
      .map((p) => ({ id: p.id, amount: centsToDollars(p.amountCents), date: p.date, note: p.note }))
      .reverse();
    const paidTotal = paymentsDollars.reduce((sum, p) => sum + p.amount, 0);
    const fixedPrice = centsToDollars(project.fixedPriceCents);

    return {
      project: { ...project, client, collaborators, fixedPrice },
      payments: paymentsDollars,
      timeline: projectTimeline,
      paidTotal,
      outstanding: fixedPrice - paidTotal,
    };
  }, [workspaceId, projectId]);
}

export type ClientListRow = ClientRow & {
  projectCount: number;
  activeCount: number;
  bookedTotal: number;
  outstandingTotal: number;
  lastContactAt: number;
};

export function useClientsForList(workspaceId: string | undefined): ClientListRow[] {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return [];
      const db = getDb();
      const [clients, projects, lastContact] = await Promise.all([
        db.clients.where("workspaceId").equals(workspaceId).sortBy("companyName"),
        db.projects.where("workspaceId").equals(workspaceId).toArray(),
        latestEventByEntity(workspaceId, "client"),
      ]);
      const projectsByClient = new Map<string, ProjectRow[]>();
      for (const p of projects) {
        const list = projectsByClient.get(p.clientId) ?? [];
        list.push(p);
        projectsByClient.set(p.clientId, list);
      }
      const paidTotals = await paidTotalsByProject(projects.map((p) => p.id));

      return clients.map((c) => {
        const clientProjects = projectsByClient.get(c.id) ?? [];
        const activeCount = clientProjects.filter((p) =>
          ["pending", "active", "built", "transferred"].includes(p.stage)
        ).length;
        const bookedTotal = clientProjects.reduce((sum, p) => sum + centsToDollars(p.fixedPriceCents), 0);
        const outstandingTotal = clientProjects.reduce((sum, p) => {
          const paid = paidTotals.get(p.id) ?? 0;
          return sum + (centsToDollars(p.fixedPriceCents) - paid);
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
    }, [workspaceId]) ?? []
  );
}

export type ClientDetail = {
  client: ClientRow;
  projects: (ProjectRow & { fixedPrice: number })[];
  timeline: TimelineEventRow[];
  bookedTotal: number;
  outstandingTotal: number;
} | null;

export function useClientDetail(
  workspaceId: string | undefined,
  clientId: string | undefined
): ClientDetail | undefined {
  return useLiveQuery(async () => {
    if (!workspaceId || !clientId) return null;
    const db = getDb();
    const client = await db.clients.get(clientId);
    if (!client || client.workspaceId !== workspaceId) return null;

    const [projects, timeline] = await Promise.all([
      db.projects.where("clientId").equals(clientId).sortBy("updatedAt"),
      db.timelineEvents.where("workspaceId").equals(workspaceId).toArray(),
    ]);
    const paidTotals = await paidTotalsByProject(projects.map((p) => p.id));

    const clientTimeline = timeline
      .filter((t) => t.entityType === "client" && t.entityId === clientId)
      .sort((a, b) => b.when - a.when);

    const projectsWithPrice = projects
      .map((p) => ({ ...p, fixedPrice: centsToDollars(p.fixedPriceCents) }))
      .reverse();
    const bookedTotal = projectsWithPrice.reduce((sum, p) => sum + p.fixedPrice, 0);
    const outstandingTotal = projects.reduce((sum, p) => {
      const paid = paidTotals.get(p.id) ?? 0;
      return sum + (centsToDollars(p.fixedPriceCents) - paid);
    }, 0);

    return { client, projects: projectsWithPrice, timeline: clientTimeline, bookedTotal, outstandingTotal };
  }, [workspaceId, clientId]);
}

export function useOverviewCounts(workspaceId: string | undefined) {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return { active: 0, built: 0, onboarding: 0, rejected: 0 };
      const projects = await allProjectsWithClient(workspaceId);
      const db = getDb();
      const clients = await db.clients.where("workspaceId").equals(workspaceId).toArray();
      const live = projects.filter((p) => p.stage !== "rejected" && !p.archivedAt);
      return {
        active: live.filter((p) => p.stage === "active").length,
        built: live.filter((p) => p.stage === "built").length,
        onboarding: clients.filter((c) => c.onboardingStatus === "pending").length,
        rejected: live.filter((p) => p.client.onboardingStatus === "rejected").length,
      };
    }, [workspaceId]) ?? { active: 0, built: 0, onboarding: 0, rejected: 0 }
  );
}

export function useArchive(workspaceId: string | undefined) {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return { rejected: [], archived: [] };
      const projects = await allProjectsWithClient(workspaceId);
      const rejected = projects
        .filter((p) => p.stage === "rejected")
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const archived = projects
        .filter((p) => p.archivedAt !== null && p.stage !== "rejected")
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
      return { rejected, archived };
    }, [workspaceId]) ?? { rejected: [], archived: [] }
  );
}

export function useClientsPicker(workspaceId: string | undefined) {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return [];
      const db = getDb();
      const clients = await db.clients.where("workspaceId").equals(workspaceId).sortBy("companyName");
      return clients.map((c) => ({ id: c.id, companyName: c.companyName }));
    }, [workspaceId]) ?? []
  );
}

export function useCabinetCounts(workspaceId: string | undefined) {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return { projectCount: 0, clientCount: 0, archiveCount: 0 };
      const db = getDb();
      const [projects, clients] = await Promise.all([
        db.projects.where("workspaceId").equals(workspaceId).toArray(),
        db.clients.where("workspaceId").equals(workspaceId).count(),
      ]);
      const projectCount = projects.filter((p) => p.stage !== "rejected" && !p.archivedAt).length;
      const archiveCount = projects.filter((p) => p.stage === "rejected" || p.archivedAt !== null).length;
      return { projectCount, clientCount: clients, archiveCount };
    }, [workspaceId]) ?? { projectCount: 0, clientCount: 0, archiveCount: 0 }
  );
}

export { daysAgo } from "@/lib/format";
