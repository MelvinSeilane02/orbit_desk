import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { createProjectAction } from "@/lib/actions/projects";
import { requireWorkspace } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isOfflineMode } from "@/lib/offline/mode";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

export const metadata: Metadata = { title: "Give them a project — Orbit Desk" };

export default async function FirstProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  if (isOfflineMode()) redirect("/overview");

  const { clientId } = await searchParams;
  const workspace = await requireWorkspace();
  const clients = await prisma.client.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });

  const justFiledClient = clientId
    ? clients.find((c) => c.id === clientId)
    : undefined;

  return (
    <div className="od-shell">
      <nav className="od-nav">
        <span className="od-brand">
          <BrandMark />
          <BrandWordmark />
        </span>
        <span className="od-kick" style={{ marginLeft: "auto" }}>
          Step 3 of 3
        </span>
      </nav>
      <div className="flex flex-1 items-center justify-center p-9">
        <div className="flex w-full max-w-[540px] flex-col gap-[18px]">
          {justFiledClient && (
            <div className="od-warn od-warn-ok">
              <span className="od-dot" style={{ background: "var(--od-green)" }} />
              <span className="text-[13px]">{justFiledClient.companyName} is filed. Nice start.</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <h3>Give them a project</h3>
            <p className="od-muted text-[13.5px]">This is the thing you&apos;ll open every day.</p>
          </div>
          <div className="od-card p-6">
            <ProjectForm
              action={createProjectAction}
              clients={clients}
              defaultClientId={clientId}
              guided
              submitLabel="Create project"
            />
          </div>
          <Link href="/overview" className="od-btn od-btn-g" style={{ alignSelf: "flex-start" }}>
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
