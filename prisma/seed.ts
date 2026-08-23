import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function main() {
  const passwordHash = await bcrypt.hash("orbitdesk123", 12);

  const user = await prisma.user.upsert({
    where: { email: "marcus@reedinteractive.com" },
    update: {},
    create: { email: "marcus@reedinteractive.com", name: "Marcus Reed", passwordHash },
  });

  const workspace = await prisma.workspace.upsert({
    where: { ownerId: user.id },
    update: {},
    create: {
      ownerId: user.id,
      name: "Reed Interactive",
      currency: "USD",
      timezone: "America/New_York",
    },
  });

  // Idempotent: wipe this workspace's data before reseeding so the script is re-runnable.
  await prisma.timelineEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.payment.deleteMany({ where: { project: { workspaceId: workspace.id } } });
  await prisma.collaborator.deleteMany({ where: { project: { workspaceId: workspace.id } } });
  await prisma.project.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.client.deleteMany({ where: { workspaceId: workspace.id } });

  async function makeClient(data: {
    companyName: string;
    primaryContact?: string;
    email?: string;
    phone?: string;
    onboardingStatus?: "pending" | "onboarded" | "rejected";
    createdDaysAgo?: number;
  }) {
    const client = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        companyName: data.companyName,
        primaryContact: data.primaryContact,
        email: data.email,
        phone: data.phone,
        onboardingStatus: data.onboardingStatus ?? "onboarded",
        createdAt: daysAgo(data.createdDaysAgo ?? 200),
      },
    });
    await prisma.timelineEvent.create({
      data: {
        workspaceId: workspace.id,
        entityType: "client",
        entityId: client.id,
        what: `${client.companyName} is filed. Nice start.`,
        when: daysAgo(data.createdDaysAgo ?? 200),
      },
    });
    return client;
  }

  async function makeProject(data: {
    clientId: string;
    name: string;
    fixedPrice: number;
    stage: "pending" | "active" | "built" | "transferred" | "completed" | "rejected";
    startedDaysAgo?: number;
    builtDaysAgo?: number;
    transferredDaysAgo?: number;
    archivedDaysAgo?: number;
    rejectionReason?: string;
    rejectedBy?: "you" | "client";
    payments?: Array<{ amount: number; daysAgo: number; note?: string }>;
    lastEventDaysAgo?: number;
  }) {
    // The DB trigger (fn_projects_guard_completion) blocks inserting a row
    // that's already 'completed' — a project can only reach Completed via an
    // UPDATE from 'transferred'. Seed it as transferred first, then bump it.
    const insertStage = data.stage === "completed" ? "transferred" : data.stage;

    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        clientId: data.clientId,
        name: data.name,
        fixedPrice: data.fixedPrice,
        stage: insertStage,
        startedAt: data.startedDaysAgo !== undefined ? daysAgo(data.startedDaysAgo) : null,
        builtAt: data.builtDaysAgo !== undefined ? daysAgo(data.builtDaysAgo) : null,
        transferredAt: data.transferredDaysAgo !== undefined ? daysAgo(data.transferredDaysAgo) : null,
        archivedAt: data.archivedDaysAgo !== undefined ? daysAgo(data.archivedDaysAgo) : null,
        rejectionReason: data.rejectionReason,
        rejectedBy: data.rejectedBy,
        createdAt: daysAgo((data.startedDaysAgo ?? 30) + 2),
        updatedAt: daysAgo(data.lastEventDaysAgo ?? data.startedDaysAgo ?? 0),
      },
    });

    if (data.stage === "completed") {
      await prisma.project.update({ where: { id: project.id }, data: { stage: "completed" } });
    }

    await prisma.timelineEvent.create({
      data: {
        workspaceId: workspace.id,
        entityType: "project",
        entityId: project.id,
        what: "Project created",
        when: daysAgo((data.startedDaysAgo ?? 30) + 2),
      },
    });

    for (const p of data.payments ?? []) {
      await prisma.payment.create({
        data: { projectId: project.id, amount: p.amount, date: daysAgo(p.daysAgo), note: p.note },
      });
      await prisma.timelineEvent.create({
        data: {
          workspaceId: workspace.id,
          entityType: "project",
          entityId: project.id,
          what: `Payment recorded — $${p.amount.toLocaleString()}`,
          when: daysAgo(p.daysAgo),
        },
      });
      await prisma.timelineEvent.create({
        data: {
          workspaceId: workspace.id,
          entityType: "client",
          entityId: data.clientId,
          what: `Payment recorded — $${p.amount.toLocaleString()} — ${data.name}`,
          when: daysAgo(p.daysAgo),
        },
      });
    }

    return project;
  }

  // ---- Clients ----
  const arbor = await makeClient({
    companyName: "Arbor Health",
    primaryContact: "Priya Raman",
    email: "priya@arborhealth.co",
    phone: "+1 412 555 0148",
    onboardingStatus: "onboarded",
    createdDaysAgo: 340,
  });
  const kestrel = await makeClient({
    companyName: "Kestrel Coffee",
    primaryContact: "Tom Delaney",
    email: "tom@kestrel.coffee",
    onboardingStatus: "onboarded",
    createdDaysAgo: 260,
  });
  const northgate = await makeClient({
    companyName: "Northgate Legal",
    primaryContact: "Susan Whitby",
    email: "s.whitby@northgate.legal",
    onboardingStatus: "pending",
    createdDaysAgo: 12,
  });
  const fable = await makeClient({
    companyName: "Studio Fable",
    primaryContact: "Ines Marchetti",
    email: "ines@studiofable.it",
    onboardingStatus: "onboarded",
    createdDaysAgo: 400,
  });
  const halden = await makeClient({
    companyName: "Halden Logistics",
    primaryContact: "Erik Sandvik",
    email: "erik@haldenlog.no",
    onboardingStatus: "onboarded",
    createdDaysAgo: 90,
  });
  const brightLane = await makeClient({
    companyName: "Bright Lane Dental",
    primaryContact: "Dr. A. Osei",
    email: "admin@brightlane.dental",
    onboardingStatus: "onboarded",
    createdDaysAgo: 500,
  });
  const tidewater = await makeClient({
    companyName: "Tidewater Kayaks",
    primaryContact: "Jo Pike",
    email: "jo@tidewaterkayaks.com",
    onboardingStatus: "onboarded",
    createdDaysAgo: 150,
  });
  const cobalt = await makeClient({
    companyName: "Cobalt Fitness",
    primaryContact: "Ray Nunez",
    email: "ray@cobaltfitness.gym",
    onboardingStatus: "pending",
    createdDaysAgo: 5,
  });
  const verity = await makeClient({
    companyName: "Verity Books",
    primaryContact: "Fran Adeyemi",
    email: "fran@veritybooks.co",
    onboardingStatus: "onboarded",
    createdDaysAgo: 600,
  });
  const marrow = await makeClient({
    companyName: "Marrow & Sons",
    primaryContact: "Deborah Marrow",
    email: "deborah@marrowandsons.com",
    onboardingStatus: "rejected",
    createdDaysAgo: 45,
  });

  // ---- Projects ----
  await makeProject({
    clientId: arbor.id,
    name: "Patient portal rebuild",
    fixedPrice: 18400,
    stage: "active",
    startedDaysAgo: 50,
    lastEventDaysAgo: 2,
    payments: [{ amount: 9200, daysAgo: 40, note: "Deposit" }],
  });
  await makeProject({
    clientId: arbor.id,
    name: "Staff scheduling tool",
    fixedPrice: 14500,
    stage: "completed",
    startedDaysAgo: 260,
    builtDaysAgo: 220,
    transferredDaysAgo: 200,
    payments: [{ amount: 14500, daysAgo: 205 }],
  });
  await makeProject({
    clientId: arbor.id,
    name: "Intake form redesign",
    fixedPrice: 8400,
    stage: "completed",
    startedDaysAgo: 320,
    builtDaysAgo: 300,
    transferredDaysAgo: 290,
    payments: [{ amount: 8400, daysAgo: 295 }],
  });

  await makeProject({
    clientId: kestrel.id,
    name: "Online ordering",
    fixedPrice: 6200,
    stage: "built",
    startedDaysAgo: 60,
    builtDaysAgo: 21,
    lastEventDaysAgo: 21,
    payments: [{ amount: 3100, daysAgo: 40, note: "Deposit" }],
  });

  await makeProject({
    clientId: northgate.id,
    name: "Marketing site",
    fixedPrice: 4800,
    stage: "pending",
    startedDaysAgo: 4,
    lastEventDaysAgo: 4,
  });

  await makeProject({
    clientId: fable.id,
    name: "Portfolio CMS",
    fixedPrice: 9750,
    stage: "active",
    startedDaysAgo: 10,
    lastEventDaysAgo: 0,
    payments: [{ amount: 4000, daysAgo: 8 }],
  });
  await makeProject({
    clientId: fable.id,
    name: "Case study template",
    fixedPrice: 6400,
    stage: "completed",
    startedDaysAgo: 90,
    builtDaysAgo: 70,
    transferredDaysAgo: 60,
    payments: [{ amount: 6400, daysAgo: 65 }],
  });

  await makeProject({
    clientId: halden.id,
    name: "Driver dashboard",
    fixedPrice: 24000,
    stage: "active",
    startedDaysAgo: 45,
    lastEventDaysAgo: 16,
    payments: [{ amount: 12000, daysAgo: 40, note: "Deposit" }],
  });

  await makeProject({
    clientId: brightLane.id,
    name: "Booking widget",
    fixedPrice: 3400,
    stage: "transferred",
    startedDaysAgo: 30,
    builtDaysAgo: 14,
    transferredDaysAgo: 7,
    payments: [{ amount: 3400, daysAgo: 8 }],
  });

  await makeProject({
    clientId: tidewater.id,
    name: "Seasonal booking",
    fixedPrice: 5600,
    stage: "active",
    startedDaysAgo: 8,
    lastEventDaysAgo: 3,
    payments: [{ amount: 2800, daysAgo: 6, note: "Deposit" }],
  });

  await makeProject({
    clientId: cobalt.id,
    name: "Member app",
    fixedPrice: 31000,
    stage: "pending",
    startedDaysAgo: 5,
    lastEventDaysAgo: 5,
  });

  await makeProject({
    clientId: verity.id,
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
    clientId: marrow.id,
    name: "Inventory tool",
    fixedPrice: 7200,
    stage: "rejected",
    startedDaysAgo: 60,
    lastEventDaysAgo: 18,
    rejectionReason: "Client declined on price",
    rejectedBy: "client",
  });

  // A couple more archived/rejected rows so the Archive screen has real variety.
  const pikeRowe = await makeClient({
    companyName: "Pike & Rowe",
    primaryContact: "Nadia Pike",
    onboardingStatus: "rejected",
    createdDaysAgo: 200,
  });
  await makeProject({
    clientId: pikeRowe.id,
    name: "Loyalty scheme",
    fixedPrice: 5000,
    stage: "rejected",
    startedDaysAgo: 90,
    lastEventDaysAgo: 80,
    rejectionReason: "Went with an agency",
    rejectedBy: "client",
  });

  const aldgate = await makeClient({
    companyName: "Aldgate Prints",
    primaryContact: "Owen Clarke",
    onboardingStatus: "onboarded",
    createdDaysAgo: 400,
  });
  await makeProject({
    clientId: aldgate.id,
    name: "Kiosk build",
    fixedPrice: 9000,
    stage: "completed",
    startedDaysAgo: 300,
    builtDaysAgo: 260,
    transferredDaysAgo: 250,
    archivedDaysAgo: 200,
    payments: [{ amount: 9000, daysAgo: 255 }],
  });

  // Manual (non-auto) notes for texture.
  await prisma.timelineEvent.create({
    data: {
      workspaceId: workspace.id,
      entityType: "client",
      entityId: arbor.id,
      what: "Called about phase two. Priya wants the appointments module next, budget likely similar.",
      auto: false,
      when: daysAgo(2),
    },
  });

  console.log("Seeded workspace:", workspace.name);
  console.log("Sign in with marcus@reedinteractive.com / orbitdesk123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
