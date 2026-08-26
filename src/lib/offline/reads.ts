"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/offline/db";
import { Money, sumMoney } from "@/lib/money";
import { computeAttention, type AttentionItem } from "@/lib/attention";
import type { ClientRow, ProjectRow, TimelineEventRow } from "@/lib/offline/db";

async function workspaceCurrency(workspaceId: string): Promise<string> {
  const workspace = await getDb().workspaces.get(workspaceId);
  return workspace?.currency ?? "USD";
}

/** Rows written before per-project currency existed have no `currency` —
 * treat those as priced in whatever the workspace default is. */
function projectCurrency(p: { currency?: string }, workspaceDefault: string): string {
  return p.currency ?? workspaceDefault;
}

function projectConversionRate(p: { conversionRate?: number }): number {
  return p.conversionRate ?? 1;
}

/** A project's fixed price, converted from its own currency into the
 * workspace default — for totals that combine multiple projects, which may
 * be priced in different currencies. */
function fixedPriceInDefaultCurrency(p: { fixedPriceCents: number; currency?: string; conversionRate?: number }, workspaceDefault: string): Money {
  return Money.fromCents(p.fixedPriceCents, projectCurrency(p, workspaceDefault)).convert(
    projectConversionRate(p),
    workspaceDefault
  );
}

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

/** Payments are recorded in whatever currency their project is priced in
 * (see writes/projects.ts recordPayment), so each project's total is kept
 * in that project's own currency here — callers that combine totals across
 * projects convert with fixedPriceInDefaultCurrency()/Money.convert(). */
async function paidTotalsByProject(
  projects: { id: string; currency?: string }[],
  workspaceDefault: string
) {
  const db = getDb();
  const projectIds = projects.map((p) => p.id);
  const currencyByProject = new Map(projects.map((p) => [p.id, projectCurrency(p, workspaceDefault)]));
  const payments = projectIds.length
    ? await db.payments.where("projectId").anyOf(projectIds).toArray()
    : [];
  const totals = new Map<string, Money>();
  for (const pay of payments) {
    const currency = currencyByProject.get(pay.projectId) ?? workspaceDefault;
    const amount = Money.fromCents(pay.amountCents, currency);
    totals.set(pay.projectId, (totals.get(pay.projectId) ?? Money.zero(currency)).add(amount));
  }
  return totals;
}

export type ProjectListRow = ProjectWithClient & {
  fixedPrice: Money;
  paidTotal: Money;
  outstanding: Money;
  lastActivity: number;
};

export function useProjectsForList(workspaceId: string | undefined): ProjectListRow[] {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return [];
      const defaultCurrency = await workspaceCurrency(workspaceId);
      const projects = await allProjectsWithClient(workspaceId);
      const [lastActivity, paidTotals] = await Promise.all([
        latestEventByEntity(workspaceId, "project"),
        paidTotalsByProject(projects, defaultCurrency),
      ]);
      return projects.map((p) => {
        const currency = projectCurrency(p, defaultCurrency);
        const fixedPrice = Money.fromCents(p.fixedPriceCents, currency);
        const paidTotal = paidTotals.get(p.id) ?? Money.zero(currency);
        return {
          ...p,
          fixedPrice,
          paidTotal,
          outstanding: fixedPrice.subtract(paidTotal),
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
    fixedPrice: Money;
    currency: string;
  };
  payments: { id: string; amount: Money; date: number; note: string | null }[];
  timeline: TimelineEventRow[];
  paidTotal: Money;
  outstanding: Money;
  /** Outstanding converted into the workspace default currency, only when
   * the project's own currency differs from it — lets the detail page show
   * "≈ $X in USD" alongside the native-currency figure. */
  outstandingInDefaultCurrency: Money | null;
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

    const defaultCurrency = await workspaceCurrency(workspaceId);
    const currency = projectCurrency(project, defaultCurrency);
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

    const paymentsMoney = payments
      .map((p) => ({ id: p.id, amount: Money.fromCents(p.amountCents, currency), date: p.date, note: p.note }))
      .reverse();
    const paidTotal = sumMoney(paymentsMoney.map((p) => p.amount), currency);
    const fixedPrice = Money.fromCents(project.fixedPriceCents, currency);
    const outstanding = fixedPrice.subtract(paidTotal);

    return {
      project: { ...project, client, collaborators, fixedPrice, currency },
      payments: paymentsMoney,
      timeline: projectTimeline,
      paidTotal,
      outstanding,
      outstandingInDefaultCurrency:
        currency === defaultCurrency ? null : outstanding.convert(projectConversionRate(project), defaultCurrency),
    };
  }, [workspaceId, projectId]);
}

export type ClientListRow = ClientRow & {
  projectCount: number;
  activeCount: number;
  bookedTotal: Money;
  outstandingTotal: Money;
  lastContactAt: number;
};

export function useClientsForList(workspaceId: string | undefined): ClientListRow[] {
  return (
    useLiveQuery(async () => {
      if (!workspaceId) return [];
      const db = getDb();
      const defaultCurrency = await workspaceCurrency(workspaceId);
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
      const paidTotals = await paidTotalsByProject(projects, defaultCurrency);

      return clients.map((c) => {
        const clientProjects = projectsByClient.get(c.id) ?? [];
        const activeCount = clientProjects.filter((p) =>
          ["pending", "active", "built", "transferred"].includes(p.stage)
        ).length;
        // Client projects can each be priced in a different currency, so
        // every figure is converted to the workspace default before summing.
        const bookedTotal = sumMoney(
          clientProjects.map((p) => fixedPriceInDefaultCurrency(p, defaultCurrency)),
          defaultCurrency
        );
        const outstandingTotal = clientProjects.reduce((sum, p) => {
          const currency = projectCurrency(p, defaultCurrency);
          const paid = paidTotals.get(p.id) ?? Money.zero(currency);
          const outstanding = Money.fromCents(p.fixedPriceCents, currency).subtract(paid);
          return sum.add(outstanding.convert(projectConversionRate(p), defaultCurrency));
        }, Money.zero(defaultCurrency));
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
  projects: (ProjectRow & { fixedPrice: Money })[];
  timeline: TimelineEventRow[];
  bookedTotal: Money;
  outstandingTotal: Money;
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

    const defaultCurrency = await workspaceCurrency(workspaceId);
    const [projects, timeline] = await Promise.all([
      db.projects.where("clientId").equals(clientId).sortBy("updatedAt"),
      db.timelineEvents.where("workspaceId").equals(workspaceId).toArray(),
    ]);
    const paidTotals = await paidTotalsByProject(projects, defaultCurrency);

    const clientTimeline = timeline
      .filter((t) => t.entityType === "client" && t.entityId === clientId)
      .sort((a, b) => b.when - a.when);

    // Each project row keeps its own native currency for display...
    const projectsWithPrice = projects
      .map((p) => ({ ...p, fixedPrice: Money.fromCents(p.fixedPriceCents, projectCurrency(p, defaultCurrency)) }))
      .reverse();
    // ...but the summary totals combine projects, so those convert to the
    // workspace default first.
    const bookedTotal = sumMoney(
      projects.map((p) => fixedPriceInDefaultCurrency(p, defaultCurrency)),
      defaultCurrency
    );
    const outstandingTotal = projects.reduce((sum, p) => {
      const currency = projectCurrency(p, defaultCurrency);
      const paid = paidTotals.get(p.id) ?? Money.zero(currency);
      const outstanding = Money.fromCents(p.fixedPriceCents, currency).subtract(paid);
      return sum.add(outstanding.convert(projectConversionRate(p), defaultCurrency));
    }, Money.zero(defaultCurrency));

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
