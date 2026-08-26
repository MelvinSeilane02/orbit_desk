"use client";

import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { useProjectDetail, useAttentionItems } from "@/lib/offline/reads";
import {
  setActive,
  markCompleted,
  removeCollaborator,
  archiveProject,
  addProjectNote,
  markBuilt,
  transferOwnership,
  rejectProject,
  addCollaborator,
  updateProject,
  recordPayment,
} from "@/lib/offline/writes/projects";
import { formatDateShort, formatContactName } from "@/lib/format";
import { StageLadder } from "@/components/ui/StageLadder";
import { StatusTag, stageTone } from "@/components/ui/StatusTag";
import { PaymentModal } from "@/components/projects/PaymentModal";
import { MarkBuiltModal, TransferModal, RejectModal } from "@/components/projects/LifecycleModals";
import { CollaboratorModal } from "@/components/projects/CollaboratorModal";
import { EditProjectModal } from "@/components/projects/ProjectModals";
import { SubmitButton } from "@/components/loading/SubmitButton";
import { DocumentStackAlignment } from "@/components/loading/DocumentStackAlignment";
import { useDelayedPending } from "@/lib/loading/useDelayedPending";

export function OfflineProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { workspace } = useOfflineWorkspace();
  const detail = useProjectDetail(workspace.id, params.id);
  const attention = useAttentionItems(workspace.id);
  const showLoading = useDelayedPending(detail === undefined);

  if (detail === undefined) {
    return showLoading ? (
      <div className="flex min-h-0 flex-1 flex-col">
        <DocumentStackAlignment />
      </div>
    ) : null;
  }
  if (detail === null) notFound();

  const { project, timeline, paidTotal, outstanding, outstandingInDefaultCurrency } = detail;
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
          <ProjectPrimaryAction workspaceId={workspace.id} projectId={project.id} stage={project.stage} />
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
            <form action={(fd) => addProjectNote(workspace.id, fd)}>
              <input type="hidden" name="projectId" value={project.id} />
              <textarea name="note" className="od-input od-input-dashed" placeholder="Write a note — stage changes and payments log themselves" />
              <div className="mt-2 flex justify-end">
                <SubmitButton className="od-btn od-btn-s">Add note</SubmitButton>
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
          <FactsBlock title={project.currency === workspace.currency ? "Pricing" : `Pricing · ${project.currency}`}>
            <div className="flex flex-col gap-[9px]">
              <MoneyRow label="Fixed price" value={project.fixedPrice.format()} />
              <MoneyRow label={`Paid · ${detail.payments.length} payment${detail.payments.length === 1 ? "" : "s"}`} value={paidTotal.format()} />
              <div className="flex justify-between pt-[9px]" style={{ borderTop: "1px solid var(--od-rule-2)" }}>
                <span className="text-[13px] font-extrabold">Outstanding</span>
                <span className="od-num text-[13.5px]" style={{ color: outstanding.isPositive() ? "var(--od-yellow)" : undefined }}>
                  {outstanding.format()}
                </span>
              </div>
              {outstandingInDefaultCurrency && (
                <div className="flex justify-between">
                  <span />
                  <span className="od-muted text-[11px]">≈ {outstandingInDefaultCurrency.format()} at your rate</span>
                </div>
              )}
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
                  <form action={(fd) => removeCollaborator(workspace.id, fd)}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="collaboratorId" value={c.id} />
                    <SubmitButton className="od-btn-g text-[11px]" style={{ padding: 2 }}>Remove</SubmitButton>
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
                <form action={(fd) => markCompleted(workspace.id, fd)}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <SubmitButton className="od-btn od-btn-s w-full">Mark completed</SubmitButton>
                </form>
              )}
              {project.stage === "completed" && (
                <form action={(fd) => archiveProject(workspace.id, fd)}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <SubmitButton className="od-btn od-btn-s w-full">Archive</SubmitButton>
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
        fixedPrice={project.fixedPrice.toDollars()}
        paidTotal={paidTotal.toDollars()}
        outstanding={outstanding.toDollars()}
        currency={project.currency}
        action={(state, fd) => recordPayment(workspace.id, state, fd)}
      />
      <MarkBuiltModal
        projectId={project.id}
        projectName={project.name}
        clientName={project.client.companyName}
        action={(state, fd) => markBuilt(workspace.id, state, fd)}
      />
      <TransferModal
        projectId={project.id}
        projectName={project.name}
        clientName={project.client.companyName}
        contactName={formatContactName(project.client.primaryContactFirstName, project.client.primaryContactSurname)}
        outstanding={outstanding.toDollars()}
        currency={project.currency}
        action={(state, fd) => transferOwnership(workspace.id, state, fd)}
      />
      <RejectModal
        projectId={project.id}
        projectName={project.name}
        clientName={project.client.companyName}
        action={(state, fd) => rejectProject(workspace.id, state, fd)}
      />
      <CollaboratorModal projectId={project.id} action={(fd) => addCollaborator(workspace.id, fd)} />
      <EditProjectModal
        project={{
          id: project.id,
          name: project.name,
          fixedPrice: String(project.fixedPrice.toDollars()),
          currency: project.currency,
          conversionRate: project.conversionRate,
        }}
        workspaceCurrency={workspace.currency}
        action={(state, fd) => updateProject(workspace.id, state, fd)}
      />
    </div>
  );
}

function ProjectPrimaryAction({
  workspaceId,
  projectId,
  stage,
}: {
  workspaceId: string;
  projectId: string;
  stage: string;
}) {
  if (stage === "pending") {
    return (
      <form action={(fd) => setActive(workspaceId, fd)}>
        <input type="hidden" name="projectId" value={projectId} />
        <SubmitButton className="od-btn od-btn-p">Start work</SubmitButton>
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

function DateRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between">
      <span className="od-muted text-[13px]">{label}</span>
      <span className="text-[13px]" style={{ color: value ? undefined : "#6d635b" }}>
        {value ? formatDateShort(value) : "—"}
      </span>
    </div>
  );
}
