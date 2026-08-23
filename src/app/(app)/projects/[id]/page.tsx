import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/session";
import { getProjectDetail, getAttentionItems } from "@/lib/data";
import { formatMoney, formatDateShort } from "@/lib/format";
import { StageLadder } from "@/components/ui/StageLadder";
import { StatusTag, stageTone } from "@/components/ui/StatusTag";
import { PaymentModal } from "@/components/projects/PaymentModal";
import { MarkBuiltModal, TransferModal, RejectModal } from "@/components/projects/LifecycleModals";
import { CollaboratorModal } from "@/components/projects/CollaboratorModal";
import { EditProjectModal } from "@/components/projects/ProjectModals";
import { addProjectNoteAction, setActiveAction, markCompletedAction, removeCollaboratorAction, archiveProjectAction } from "@/lib/actions/projects";
import { isOfflineMode } from "@/lib/offline/mode";
import { OfflineProjectDetailPage } from "./OfflineProjectDetailPage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (isOfflineMode()) return { title: "Project — Orbit Desk" };
  const { id } = await params;
  const workspace = await requireWorkspace();
  const detail = await getProjectDetail(workspace.id, id);
  return { title: detail ? `${detail.project.name} — Orbit Desk` : "Project — Orbit Desk" };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (isOfflineMode()) return <OfflineProjectDetailPage />;

  const { id } = await params;
  const workspace = await requireWorkspace();
  const detail = await getProjectDetail(workspace.id, id);
  if (!detail) notFound();

  const { project, timeline, paidTotal, outstanding } = detail;
  const attention = await getAttentionItems(workspace.id);
  const flag = attention.find((a) => a.projectId === project.id);
  const { tone, label } = stageTone(project.stage);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-[9px] px-[30px] py-3" style={{ borderBottom: "1px solid var(--od-rule)", background: "var(--od-surface)" }}>
        <Link href="/projects" style={{ fontSize: 11.5, color: "var(--od-brass)" }}>Projects</Link>
        <span style={{ fontSize: 11.5, color: "#5d544d" }}>/</span>
        <Link href={`/clients/${project.clientId}`} style={{ fontSize: 11.5, color: "var(--od-brass)" }}>
          {project.client.companyName}
        </Link>
        <span style={{ fontSize: 11.5, color: "#5d544d" }}>/</span>
        <span style={{ fontSize: 11.5, fontWeight: 800 }}>{project.name}</span>
      </div>

      <div className="flex flex-none flex-wrap items-start justify-between gap-[18px] px-[30px] py-[22px]" style={{ borderBottom: "1px solid var(--od-rule-2)" }}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2>{project.name}</h2>
            <StatusTag tone={tone} label={label} />
          </div>
          <span className="od-muted text-[13px]">
            {project.client.companyName}
            {project.startedAt ? ` · started ${formatDateShort(project.startedAt)}` : ""}
          </span>
        </div>
        <div className="flex flex-none flex-wrap gap-[9px]">
          {project.stage !== "rejected" && (
            <Link href="?payment=1" className="od-btn od-btn-s">Record a payment</Link>
          )}
          <PrimaryAction stage={project.stage} projectId={project.id} />
          <Link href="?edit=1" className="od-btn od-btn-s">Edit</Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-[22px] p-[22px] md:overflow-y-auto md:p-[26px]">
          {flag && (
            <div className="od-warn">
              <span className="od-dot" style={{ background: "var(--od-yellow)" }} />
              <span className="text-[13px]">{flag.why}.</span>
              <Link href={flag.kind === "onboarding" ? `/clients/${project.clientId}` : "?transfer=1"} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "var(--od-yellow)" }}>
                {flag.action}
              </Link>
            </div>
          )}

          {project.stage === "rejected" ? (
            <div className="od-card p-4 flex flex-col gap-2">
              <StatusTag tone="rejected" label="Rejected" />
              <p className="text-[13px] leading-[1.6]">{project.rejectionReason}</p>
              <span className="od-muted text-[11.5px]">Rejected by {project.rejectedBy === "client" ? "the client" : "you"}</span>
            </div>
          ) : (
            <StageLadder stage={project.stage} />
          )}

          <div className="flex min-h-0 flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <span className="od-plate">Activity</span>
              <span className="od-muted text-[12px]">{timeline.length} entries</span>
            </div>
            <form action={addProjectNoteAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <textarea name="note" className="od-input od-input-dashed" placeholder="Write a note — stage changes and payments log themselves" />
              <div className="mt-2 flex justify-end">
                <button type="submit" className="od-btn od-btn-s">Add note</button>
              </div>
            </form>
            <div>
              {timeline.map((t) => (
                <div key={t.id} className="flex gap-[15px] py-[11px]" style={{ borderTop: "1px solid var(--od-rule)" }}>
                  <span className="od-num" style={{ flex: "none", width: 50, fontSize: 11, fontWeight: 400, color: "#8d8278", paddingTop: 2 }}>
                    {formatDateShort(t.when).split(" ").slice(0, 2).join(" ")}
                  </span>
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[13px] leading-[1.5]">{t.what}</span>
                    <span style={{ fontSize: 10.5, color: "#6d635b" }}>{t.auto ? "Auto" : "You"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-none flex-col gap-[22px] p-[22px] md:w-[330px] md:p-6" style={{ borderTop: "1px solid var(--od-rule-2)", background: "var(--od-surface)" }}>
          <FactsBlock title="Pricing">
            <div className="flex flex-col gap-[9px]">
              <MoneyRow label="Fixed price" value={formatMoney(project.fixedPrice.toString(), workspace.currency)} />
              <MoneyRow label={`Paid · ${project.payments.length} payment${project.payments.length === 1 ? "" : "s"}`} value={formatMoney(paidTotal, workspace.currency)} />
              <div className="flex justify-between pt-[9px]" style={{ borderTop: "1px solid var(--od-rule-2)" }}>
                <span className="text-[13px] font-extrabold">Outstanding</span>
                <span className="od-num text-[13.5px]" style={{ color: outstanding > 0 ? "var(--od-yellow)" : undefined }}>
                  {formatMoney(outstanding, workspace.currency)}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: "#6d635b" }}>
              Invoicing and revenue reporting arrive with Money.
            </span>
          </FactsBlock>

          <FactsBlock title="Client">
            <Link href={`/clients/${project.clientId}`} className="flex items-center gap-[11px]">
              <span style={{ width: 30, height: 30, flex: "none", background: "var(--od-oak)" }} />
              <div className="flex flex-col">
                <span className="text-[13px] font-extrabold">{project.client.companyName}</span>
                <span className="od-muted text-[11px]">
                  {project.client.onboardingStatus === "onboarded" ? "Onboarded" : project.client.onboardingStatus === "pending" ? "Pending" : "Rejected"}
                </span>
              </div>
            </Link>
          </FactsBlock>

          <FactsBlock title="People">
            <div className="flex flex-col gap-[9px]">
              {project.collaborators.map((c) => (
                <div key={c.id} className="flex items-center gap-[10px]">
                  <span style={{ width: 26, height: 26, flex: "none", background: "var(--od-panel)", border: "1px solid var(--od-rule)" }} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[12.5px] font-extrabold">{c.name}</span>
                    <span className="od-muted text-[10.5px]">{c.role}</span>
                  </div>
                  <form action={removeCollaboratorAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="collaboratorId" value={c.id} />
                    <button type="submit" className="od-btn-g text-[11px]" style={{ padding: 2 }}>Remove</button>
                  </form>
                </div>
              ))}
            </div>
            <Link href="?collaborator=1" className="text-[12px] font-extrabold" style={{ color: "var(--od-brass)" }}>
              + Add collaborator
            </Link>
          </FactsBlock>

          <FactsBlock title="Dates">
            <div className="flex flex-col gap-2">
              <DateRow label="Started" value={project.startedAt} />
              <DateRow label="Built" value={project.builtAt} />
              <DateRow label="Transferred" value={project.transferredAt} />
            </div>
          </FactsBlock>

          {project.stage !== "rejected" && !project.archivedAt && (
            <div className="flex flex-col gap-[9px]">
              {project.stage === "transferred" && (
                <form action={markCompletedAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit" className="od-btn od-btn-s w-full">Mark completed</button>
                </form>
              )}
              {project.stage === "completed" && (
                <form action={archiveProjectAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit" className="od-btn od-btn-s w-full">Archive</button>
                </form>
              )}
              <Link href="?reject=1" className="od-btn od-btn-danger">Reject project</Link>
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        projectId={project.id}
        projectName={project.name}
        clientName={project.client.companyName}
        fixedPrice={Number(project.fixedPrice.toString())}
        paidTotal={paidTotal}
        outstanding={outstanding}
        currency={workspace.currency}
      />
      <MarkBuiltModal projectId={project.id} projectName={project.name} clientName={project.client.companyName} />
      <TransferModal
        projectId={project.id}
        projectName={project.name}
        clientName={project.client.companyName}
        contactName={project.client.primaryContact}
        outstanding={outstanding}
        currency={workspace.currency}
      />
      <RejectModal projectId={project.id} projectName={project.name} clientName={project.client.companyName} />
      <CollaboratorModal projectId={project.id} />
      <EditProjectModal project={{ id: project.id, name: project.name, fixedPrice: project.fixedPrice.toString() }} />
    </div>
  );
}

function PrimaryAction({ stage, projectId }: { stage: string; projectId: string }) {
  if (stage === "pending") {
    return (
      <form action={setActiveAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <button type="submit" className="od-btn od-btn-p">Start work</button>
      </form>
    );
  }
  if (stage === "active") {
    return <Link href="?markbuilt=1" className="od-btn od-btn-p">Mark as built</Link>;
  }
  if (stage === "built") {
    return <Link href="?transfer=1" className="od-btn od-btn-p">Transfer ownership</Link>;
  }
  return null;
}

function FactsBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[11px]">
      <span className="od-plate">{title}</span>
      {children}
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="od-muted text-[13px]">{label}</span>
      <span className="od-num text-[13.5px]">{value}</span>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: Date | null }) {
  return (
    <div className="flex justify-between">
      <span className="od-muted text-[13px]">{label}</span>
      <span className="text-[13px]" style={{ color: value ? undefined : "#6d635b" }}>
        {value ? formatDateShort(value) : "—"}
      </span>
    </div>
  );
}

