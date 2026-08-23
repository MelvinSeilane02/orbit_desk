import { daysAgo } from "@/lib/format";

/** Structural shape, not a Prisma-payload type, so both the Prisma-backed
 * (online) and Dexie-backed (offline) data layers can call this with their
 * own row shapes — only the fields actually read here need to line up. */
type ProjectWithClient = {
  id: string;
  name: string;
  clientId: string;
  stage: "pending" | "active" | "built" | "transferred" | "completed" | "rejected";
  archivedAt: Date | string | number | null;
  builtAt: Date | string | number | null;
  updatedAt: Date | string | number;
  client: {
    onboardingStatus: "pending" | "onboarded" | "rejected";
    companyName: string;
  };
};

export type AttentionItem = {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  why: string;
  action: string;
  /** Where the primary action button should navigate/trigger. */
  kind: "transfer" | "note" | "onboarding" | "archive";
};

const STALE_DAYS = 14;

/**
 * The four attention rules from the Master Build Spec §5. `lastActivity` is
 * the latest of the project's own updatedAt and its most recent timeline
 * event, passed in per-project since it requires a join the caller already did.
 */
export function computeAttention(
  projects: ProjectWithClient[],
  lastActivityByProjectId: ReadonlyMap<string, Date | string | number>
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const project of projects) {
    if (project.stage === "rejected" || project.archivedAt) continue;

    // Rule 4: every associated client rejected (single-client model: the client is rejected).
    if (project.client.onboardingStatus === "rejected") {
      items.push({
        projectId: project.id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: project.client.companyName,
        why: "Client rejected — reason logged",
        action: "Archive",
        kind: "archive",
      });
      continue;
    }

    // Rule 3: client onboarding incomplete.
    if (project.client.onboardingStatus === "pending") {
      items.push({
        projectId: project.id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: project.client.companyName,
        why: "Client onboarding incomplete",
        action: "Finish onboarding",
        kind: "onboarding",
      });
      continue;
    }

    // Rule 1: built but not transferred, 14+ days.
    if (project.stage === "built" && project.builtAt) {
      const built = daysAgo(project.builtAt);
      if (built >= STALE_DAYS) {
        items.push({
          projectId: project.id,
          projectName: project.name,
          clientId: project.clientId,
          clientName: project.client.companyName,
          why: `Built ${built} days ago — ownership not transferred`,
          action: "Transfer",
          kind: "transfer",
        });
        continue;
      }
    }

    // Rule 2: no activity in 14+ days (only for work still in flight).
    if (["pending", "active", "built", "transferred"].includes(project.stage)) {
      const lastActivity = lastActivityByProjectId.get(project.id) ?? project.updatedAt;
      const idle = daysAgo(lastActivity);
      if (idle >= STALE_DAYS) {
        items.push({
          projectId: project.id,
          projectName: project.name,
          clientId: project.clientId,
          clientName: project.client.companyName,
          why: `No activity in ${idle} days`,
          action: "Log a note",
          kind: "note",
        });
      }
    }
  }

  return items;
}
