import Dexie, { type EntityTable } from "dexie";

// Dates are stored as epoch-ms numbers (not Date objects) — Dexie indexes
// and sorts numbers reliably across browsers; convert to Date only at the
// UI boundary (src/lib/format.ts helpers accept number | string | Date).

export interface UserRow {
  id: string;
  name: string;
  surname: string;
  /** No password field at all — see WHAT_WAS_BUILT.md "Offline mode (IndexedDB)". */
  username: string;
  createdAt: number;
  /** Which of this user's workspaces was last active — resolved by
   * WorkspaceProvider, falling back to the oldest workspace if unset or
   * stale (points at a workspace that no longer exists). Plain field, not
   * indexed, so no Dexie version bump was needed to add it. */
  lastActiveWorkspaceId: string | null;
}

export interface WorkspaceRow {
  id: string;
  ownerId: string;
  name: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export type OnboardingStatus = "pending" | "onboarded" | "rejected";

export interface ClientRow {
  id: string;
  workspaceId: string;
  companyName: string;
  primaryContact: string | null;
  email: string | null;
  phone: string | null;
  onboardingStatus: OnboardingStatus;
  createdAt: number;
  updatedAt: number;
}

export type ProjectStage = "pending" | "active" | "built" | "transferred" | "completed" | "rejected";
export type RejectedBy = "you" | "client";

export interface ProjectRow {
  id: string;
  workspaceId: string;
  clientId: string;
  name: string;
  fixedPriceCents: number;
  stage: ProjectStage;
  startedAt: number | null;
  builtAt: number | null;
  transferredAt: number | null;
  archivedAt: number | null;
  rejectionReason: string | null;
  rejectedBy: RejectedBy | null;
  createdAt: number;
  updatedAt: number;
}

export interface CollaboratorRow {
  id: string;
  projectId: string;
  name: string;
  role: string;
}

export interface PaymentRow {
  id: string;
  projectId: string;
  amountCents: number;
  date: number;
  note: string | null;
}

export type TimelineEntityType = "project" | "client";

export interface TimelineEventRow {
  id: string;
  workspaceId: string;
  entityType: TimelineEntityType;
  entityId: string;
  what: string;
  auto: boolean;
  actorName: string | null;
  when: number;
}

class OrbitDeskDB extends Dexie {
  users!: EntityTable<UserRow, "id">;
  workspaces!: EntityTable<WorkspaceRow, "id">;
  clients!: EntityTable<ClientRow, "id">;
  projects!: EntityTable<ProjectRow, "id">;
  collaborators!: EntityTable<CollaboratorRow, "id">;
  payments!: EntityTable<PaymentRow, "id">;
  timelineEvents!: EntityTable<TimelineEventRow, "id">;

  constructor() {
    super("orbit-desk-offline");
    this.version(1).stores({
      users: "id, username",
      workspaces: "id, ownerId",
      clients: "id, workspaceId, companyName",
      projects: "id, workspaceId, clientId, stage, updatedAt",
      collaborators: "id, projectId",
      payments: "id, projectId, date",
      timelineEvents: "id, workspaceId, [entityType+entityId], when",
    });
  }
}

let instance: OrbitDeskDB | null = null;

/** IndexedDB only exists in the browser — every caller of this module must
 * be client-side code (offline mode never runs Dexie from a Server
 * Component/Action/edge middleware). */
export function getDb(): OrbitDeskDB {
  if (typeof window === "undefined") {
    throw new Error("Offline DB (Dexie/IndexedDB) can only be used in the browser.");
  }
  if (!instance) instance = new OrbitDeskDB();
  return instance;
}
