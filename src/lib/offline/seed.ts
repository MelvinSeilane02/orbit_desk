import { getDb } from "@/lib/offline/db";
import { newId } from "@/lib/offline/ids";
import { Money } from "@/lib/money";
import { computeOnboardingComplete } from "@/lib/offline/writes/clients";
import type { OnboardingStatus, ProjectStage, RejectedBy } from "@/lib/offline/db";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => Date.now() - n * DAY;

/** Mirrors prisma/seed.ts (minus the User/auth records) so offline mode
 * starts with the same realistic demo data. Runs once, right after a new
 * local workspace is created. */
export async function seedDemoData(workspaceId: string): Promise<void> {
  const db = getDb();
  const workspace = await db.workspaces.get(workspaceId);
  const currency = workspace?.currency ?? "USD";

  async function makeClient(data: {
    companyName: string;
    primaryContactFirstName?: string;
    primaryContactSurname?: string;
    email?: string;
    phone?: string;
    onboardingStatus?: OnboardingStatus;
    createdDaysAgo?: number;
  }) {
    const id = newId();
    const createdAt = daysAgo(data.createdDaysAgo ?? 200);
    const primaryContactFirstName = data.primaryContactFirstName ?? null;
    const primaryContactSurname = data.primaryContactSurname ?? null;
    const email = data.email ?? null;
    // Same derivation logic as the online fn_clients_set_onboarding
    // trigger, so this seed stays self-consistent rather than trusting
    // data.onboardingStatus directly (see WHAT_WAS_BUILT.md).
    const { onboardingComplete, onboardingStatus } = computeOnboardingComplete({
      primaryContactFirstName,
      primaryContactSurname,
      email,
      onboardingStatus: data.onboardingStatus ?? "pending",
    });
    await db.clients.add({
      id,
      workspaceId,
      companyName: data.companyName,
      primaryContactFirstName,
      primaryContactSurname,
      email,
      phone: data.phone ?? null,
      onboardingComplete,
      onboardingStatus,
      createdAt,
      updatedAt: createdAt,
    });
    await db.timelineEvents.add({
      id: newId(),
      workspaceId,
      entityType: "client",
      entityId: id,
      what: `${data.companyName} is filed. Nice start.`,
      auto: true,
      actorName: null,
      when: createdAt,
    });
    return id;
  }

  async function makeProject(data: {
    clientId: string;
    name: string;
    fixedPrice: number;
    stage: ProjectStage;
    startedDaysAgo?: number;
    builtDaysAgo?: number;
    transferredDaysAgo?: number;
    archivedDaysAgo?: number;
    rejectionReason?: string;
    rejectedBy?: RejectedBy;
    payments?: Array<{ amount: number; daysAgo: number; note?: string }>;
    lastEventDaysAgo?: number;
  }) {
    const id = newId();
    // The completion-guard only allows reaching `completed` via an update
    // from `transferred` — insert as transferred first, then bump it, same
    // workaround the Postgres seed script uses for its DB trigger.
    const insertStage: ProjectStage = data.stage === "completed" ? "transferred" : data.stage;
    const createdAt = daysAgo((data.startedDaysAgo ?? 30) + 2);

    await db.projects.add({
      id,
      workspaceId,
      clientId: data.clientId,
      name: data.name,
      fixedPriceCents: Money.fromDollars(data.fixedPrice, currency).cents,
      currency,
      conversionRate: 1,
      stage: insertStage,
      startedAt: data.startedDaysAgo !== undefined ? daysAgo(data.startedDaysAgo) : null,
      builtAt: data.builtDaysAgo !== undefined ? daysAgo(data.builtDaysAgo) : null,
      transferredAt: data.transferredDaysAgo !== undefined ? daysAgo(data.transferredDaysAgo) : null,
      archivedAt: data.archivedDaysAgo !== undefined ? daysAgo(data.archivedDaysAgo) : null,
      rejectionReason: data.rejectionReason ?? null,
      rejectedBy: data.rejectedBy ?? null,
      createdAt,
      updatedAt: daysAgo(data.lastEventDaysAgo ?? data.startedDaysAgo ?? 0),
    });

    if (data.stage === "completed") {
      await db.projects.update(id, { stage: "completed" });
    }

    await db.timelineEvents.add({
      id: newId(),
      workspaceId,
      entityType: "project",
      entityId: id,
      what: "Project created",
      auto: true,
      actorName: null,
      when: createdAt,
    });

    for (const p of data.payments ?? []) {
      const when = daysAgo(p.daysAgo);
      await db.payments.add({
        id: newId(),
        projectId: id,
        amountCents: Money.fromDollars(p.amount, currency).cents,
        date: when,
        note: p.note ?? null,
      });
      await db.timelineEvents.add({
        id: newId(),
        workspaceId,
        entityType: "project",
        entityId: id,
        what: `Payment recorded — $${p.amount.toLocaleString()}`,
        auto: true,
        actorName: null,
        when,
      });
      await db.timelineEvents.add({
        id: newId(),
        workspaceId,
        entityType: "client",
        entityId: data.clientId,
        what: `Payment recorded — $${p.amount.toLocaleString()} — ${data.name}`,
        auto: true,
        actorName: null,
        when,
      });
    }

    return id;
  }

  const arbor = await makeClient({
    companyName: "Arbor Health",
    primaryContactFirstName: "Priya",
    primaryContactSurname: "Raman",
    email: "priya@arborhealth.co",
    phone: "+1 412 555 0148",
    onboardingStatus: "onboarded",
    createdDaysAgo: 340,
  });
  const kestrel = await makeClient({
    companyName: "Kestrel Coffee",
    primaryContactFirstName: "Tom",
    primaryContactSurname: "Delaney",
    email: "tom@kestrel.coffee",
    onboardingStatus: "onboarded",
    createdDaysAgo: 260,
  });
  // Surname deliberately omitted — "mid-onboarding" data lands on
  // `pending` once computeOnboardingComplete recomputes it, matching the
  // online seed's Northgate Legal.
  const northgate = await makeClient({
    companyName: "Northgate Legal",
    primaryContactFirstName: "Susan",
    email: "s.whitby@northgate.legal",
    onboardingStatus: "pending",
    createdDaysAgo: 12,
  });
  const fable = await makeClient({
    companyName: "Studio Fable",
    primaryContactFirstName: "Ines",
    primaryContactSurname: "Marchetti",
    email: "ines@studiofable.it",
    onboardingStatus: "onboarded",
    createdDaysAgo: 400,
  });
  const halden = await makeClient({
    companyName: "Halden Logistics",
    primaryContactFirstName: "Erik",
    primaryContactSurname: "Sandvik",
    email: "erik@haldenlog.no",
    onboardingStatus: "onboarded",
    createdDaysAgo: 90,
  });
  const brightLane = await makeClient({
    companyName: "Bright Lane Dental",
    primaryContactFirstName: "Dr. A.",
    primaryContactSurname: "Osei",
    email: "admin@brightlane.dental",
    onboardingStatus: "onboarded",
    createdDaysAgo: 500,
  });
  const tidewater = await makeClient({
    companyName: "Tidewater Kayaks",
    primaryContactFirstName: "Jo",
    primaryContactSurname: "Pike",
    email: "jo@tidewaterkayaks.com",
    onboardingStatus: "onboarded",
    createdDaysAgo: 150,
  });
  // Surname omitted for the same reason as Northgate Legal.
  const cobalt = await makeClient({
    companyName: "Cobalt Fitness",
    primaryContactFirstName: "Ray",
    email: "ray@cobaltfitness.gym",
    onboardingStatus: "pending",
    createdDaysAgo: 5,
  });
  const verity = await makeClient({
    companyName: "Verity Books",
    primaryContactFirstName: "Fran",
    primaryContactSurname: "Adeyemi",
    email: "fran@veritybooks.co",
    onboardingStatus: "onboarded",
    createdDaysAgo: 600,
  });
  const marrow = await makeClient({
    companyName: "Marrow & Sons",
    primaryContactFirstName: "Deborah",
    primaryContactSurname: "Marrow",
    email: "deborah@marrowandsons.com",
    onboardingStatus: "rejected",
    createdDaysAgo: 45,
  });

  await makeProject({
    clientId: arbor,
    name: "Patient portal rebuild",
    fixedPrice: 18400,
    stage: "active",
    startedDaysAgo: 50,
    lastEventDaysAgo: 2,
    payments: [{ amount: 9200, daysAgo: 40, note: "Deposit" }],
  });
  await makeProject({
    clientId: arbor,
    name: "Staff scheduling tool",
    fixedPrice: 14500,
    stage: "completed",
    startedDaysAgo: 260,
    builtDaysAgo: 220,
    transferredDaysAgo: 200,
    payments: [{ amount: 14500, daysAgo: 205 }],
  });
  await makeProject({
    clientId: arbor,
    name: "Intake form redesign",
    fixedPrice: 8400,
    stage: "completed",
    startedDaysAgo: 320,
    builtDaysAgo: 300,
    transferredDaysAgo: 290,
    payments: [{ amount: 8400, daysAgo: 295 }],
  });

  await makeProject({
    clientId: kestrel,
    name: "Online ordering",
    fixedPrice: 6200,
    stage: "built",
    startedDaysAgo: 60,
    builtDaysAgo: 21,
    lastEventDaysAgo: 21,
    payments: [{ amount: 3100, daysAgo: 40, note: "Deposit" }],
  });

  await makeProject({
    clientId: northgate,
    name: "Marketing site",
    fixedPrice: 4800,
    stage: "pending",
    startedDaysAgo: 4,
    lastEventDaysAgo: 4,
  });

  await makeProject({
    clientId: fable,
    name: "Portfolio CMS",
    fixedPrice: 9750,
    stage: "active",
    startedDaysAgo: 10,
    lastEventDaysAgo: 0,
    payments: [{ amount: 4000, daysAgo: 8 }],
  });
  await makeProject({
    clientId: fable,
    name: "Case study template",
    fixedPrice: 6400,
    stage: "completed",
    startedDaysAgo: 90,
    builtDaysAgo: 70,
    transferredDaysAgo: 60,
    payments: [{ amount: 6400, daysAgo: 65 }],
  });

  await makeProject({
    clientId: halden,
    name: "Driver dashboard",
    fixedPrice: 24000,
    stage: "active",
    startedDaysAgo: 45,
    lastEventDaysAgo: 16,
    payments: [{ amount: 12000, daysAgo: 40, note: "Deposit" }],
  });

  await makeProject({
    clientId: brightLane,
    name: "Booking widget",
    fixedPrice: 3400,
    stage: "transferred",
    startedDaysAgo: 30,
    builtDaysAgo: 14,
    transferredDaysAgo: 7,
    payments: [{ amount: 3400, daysAgo: 8 }],
  });

  await makeProject({
    clientId: tidewater,
    name: "Seasonal booking",
    fixedPrice: 5600,
    stage: "active",
    startedDaysAgo: 8,
    lastEventDaysAgo: 3,
    payments: [{ amount: 2800, daysAgo: 6, note: "Deposit" }],
  });

  await makeProject({
    clientId: cobalt,
    name: "Member app",
    fixedPrice: 31000,
    stage: "pending",
    startedDaysAgo: 5,
    lastEventDaysAgo: 5,
  });

  await makeProject({
    clientId: verity,
    name: "Storefront migration",
    fixedPrice: 22000,
    stage: "completed",
    startedDaysAgo: 500,
    builtDaysAgo: 470,
    transferredDaysAgo: 460,
    archivedDaysAgo: 400,
    payments: [{ amount: 22000, daysAgo: 465 }],
  });

  await makeProject({
    clientId: marrow,
    name: "Inventory tool",
    fixedPrice: 7200,
    stage: "rejected",
    startedDaysAgo: 60,
    lastEventDaysAgo: 18,
    rejectionReason: "Client declined on price",
    rejectedBy: "client",
  });

  const pikeRowe = await makeClient({
    companyName: "Pike & Rowe",
    primaryContactFirstName: "Nadia",
    primaryContactSurname: "Pike",
    onboardingStatus: "rejected",
    createdDaysAgo: 200,
  });
  await makeProject({
    clientId: pikeRowe,
    name: "Loyalty scheme",
    fixedPrice: 5000,
    stage: "rejected",
    startedDaysAgo: 90,
    lastEventDaysAgo: 80,
    rejectionReason: "Went with an agency",
    rejectedBy: "client",
  });

  // Email added — see the matching note in prisma/seed.ts.
  const aldgate = await makeClient({
    companyName: "Aldgate Prints",
    primaryContactFirstName: "Owen",
    primaryContactSurname: "Clarke",
    email: "owen@aldgateprints.co",
    onboardingStatus: "onboarded",
    createdDaysAgo: 400,
  });
  await makeProject({
    clientId: aldgate,
    name: "Kiosk build",
    fixedPrice: 9000,
    stage: "completed",
    startedDaysAgo: 300,
    builtDaysAgo: 260,
    transferredDaysAgo: 250,
    archivedDaysAgo: 200,
    payments: [{ amount: 9000, daysAgo: 255 }],
  });

  await db.timelineEvents.add({
    id: newId(),
    workspaceId,
    entityType: "client",
    entityId: arbor,
    what: "Called about phase two. Priya wants the appointments module next, budget likely similar.",
    auto: false,
    actorName: null,
    when: daysAgo(2),
  });
}

/** Manual escape hatch for local testing — drops the whole offline DB and
 * lets getOrCreateWorkspace-equivalent flows (sign-up) start clean. Not
 * wired to any UI; run `import("@/lib/offline/seed").then(m => m.resetOfflineData())`
 * from the browser console. */
export async function resetOfflineData(): Promise<void> {
  const db = getDb();
  await db.delete();
  window.location.reload();
}
