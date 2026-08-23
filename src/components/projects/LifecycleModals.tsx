"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { markBuiltAction, transferOwnershipAction, rejectProjectAction } from "@/lib/actions/projects";
import { formatMoney } from "@/lib/format";

type ModalFormState = { error?: string; redirectTo?: string } | undefined;
type LifecycleAction = (state: ModalFormState, formData: FormData) => Promise<ModalFormState>;

function useCloseModal() {
  const router = useRouter();
  const pathname = usePathname();
  return () => router.push(pathname);
}

function useRedirectOnState(state: ModalFormState) {
  const router = useRouter();
  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function MarkBuiltModal({
  projectId,
  projectName,
  clientName,
  action = markBuiltAction,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  action?: LifecycleAction;
}) {
  return (
    <QueryModal param="markbuilt" value="1">
      <MarkBuiltForm projectId={projectId} projectName={projectName} clientName={clientName} action={action} />
    </QueryModal>
  );
}

function MarkBuiltForm({
  projectId,
  projectName,
  clientName,
  action,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  action: LifecycleAction;
}) {
  const close = useCloseModal();
  const [state, formAction, pending] = useActionState<ModalFormState, FormData>(action, undefined);
  useRedirectOnState(state);

  return (
    <>
      <ModalHeader title="Mark as built" subtitle={`${projectName} · ${clientName}`} onClose={close} />
      <form action={formAction} className="od-modal-body">
        <input type="hidden" name="projectId" value={projectId} />
        <p className="od-muted text-[13px] leading-[1.6]">
          Built means the work is finished on your side. The project stays yours until you
          transfer ownership, so nothing is handed over yet.
        </p>
        <div>
          <label className="od-lab" htmlFor="builtAt">Date built</label>
          <input id="builtAt" name="builtAt" type="date" defaultValue={todayIso()} className="od-input" />
        </div>
        <div className="od-card p-3 text-[11.5px] leading-[1.55]" style={{ background: "var(--od-panel)", color: "var(--od-muted)" }}>
          Orbit Desk will remind you if this sits in Built for more than 14 days.
        </div>
        {state?.error && <p className="text-[12px]" style={{ color: "var(--od-red)" }}>{state.error}</p>}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
            <button type="submit" disabled={pending} className="od-btn od-btn-p">
              {pending ? "Saving…" : "Mark as built"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

export function TransferModal({
  projectId,
  projectName,
  clientName,
  contactName,
  outstanding,
  currency,
  action = transferOwnershipAction,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  contactName?: string | null;
  outstanding: number;
  currency: string;
  action?: LifecycleAction;
}) {
  return (
    <QueryModal param="transfer" value="1">
      <TransferForm
        projectId={projectId}
        projectName={projectName}
        clientName={clientName}
        contactName={contactName}
        outstanding={outstanding}
        currency={currency}
        action={action}
      />
    </QueryModal>
  );
}

function TransferForm({
  projectId,
  projectName,
  clientName,
  contactName,
  outstanding,
  currency,
  action,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  contactName?: string | null;
  outstanding: number;
  currency: string;
  action: LifecycleAction;
}) {
  const close = useCloseModal();
  const [state, formAction, pending] = useActionState<ModalFormState, FormData>(action, undefined);
  useRedirectOnState(state);
  const [checks, setChecks] = useState({ credentials: false, walkthrough: false });
  const uncheckedCount = Number(!checks.credentials) + Number(!checks.walkthrough) + Number(outstanding > 0);

  return (
    <>
      <ModalHeader
        title="Transfer ownership"
        subtitle={`To ${clientName}${contactName ? ` · ${contactName}` : ""}`}
        onClose={close}
      />
      <form action={formAction} className="od-modal-body">
        <input type="hidden" name="projectId" value={projectId} />
        <p className="od-muted text-[13px] leading-[1.6]">
          This is the real handover. Once transferred, {projectName} moves out of your
          active work and can be marked Completed.
        </p>
        <div className="flex flex-col gap-[10px]">
          <ChecklistToggle
            label="Credentials and access handed over"
            checked={checks.credentials}
            onChange={(v) => setChecks((c) => ({ ...c, credentials: v }))}
          />
          <ChecklistToggle
            label="Client walked through the admin"
            checked={checks.walkthrough}
            onChange={(v) => setChecks((c) => ({ ...c, walkthrough: v }))}
          />
          <div className="flex items-start gap-[10px]">
            <span style={{ width: 15, height: 15, flex: "none", border: "1px solid var(--od-rule-2)", marginTop: 2 }} />
            <div className="flex flex-col">
              <span className="text-[13px]">Final payment received</span>
              {outstanding > 0 && (
                <span className="text-[11px]" style={{ color: "var(--od-yellow)" }}>
                  {formatMoney(outstanding, currency)} still outstanding
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="od-lab" htmlFor="transferredAt">Transfer date</label>
            <input id="transferredAt" name="transferredAt" type="date" defaultValue={todayIso()} className="od-input" />
          </div>
          <div className="flex-1">
            <label className="od-lab" htmlFor="handoverNote">Handover note</label>
            <input id="handoverNote" name="handoverNote" className="od-input" placeholder="Optional" />
          </div>
        </div>
        {state?.error && <p className="text-[12px]" style={{ color: "var(--od-red)" }}>{state.error}</p>}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px" }}>
          <span className="text-[11.5px]" style={{ color: "var(--od-yellow)" }}>
            {uncheckedCount > 0 ? `${uncheckedCount} item${uncheckedCount === 1 ? "" : "s"} unchecked` : ""}
          </span>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
            <button type="submit" disabled={pending} className="od-btn od-btn-p">
              {pending ? "Transferring…" : "Transfer ownership"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function ChecklistToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-[10px] text-left"
    >
      <span
        style={{
          width: 15,
          height: 15,
          flex: "none",
          background: checked ? "var(--od-green)" : "transparent",
          border: checked ? "none" : "1px solid var(--od-rule-2)",
          color: "#12180d",
          fontSize: 9,
          fontWeight: 800,
          lineHeight: "15px",
          textAlign: "center",
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-[13px]">{label}</span>
    </button>
  );
}

export function RejectModal({
  projectId,
  projectName,
  clientName,
  action = rejectProjectAction,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  action?: LifecycleAction;
}) {
  return (
    <QueryModal param="reject" value="1">
      <RejectForm projectId={projectId} projectName={projectName} clientName={clientName} action={action} />
    </QueryModal>
  );
}

function RejectForm({
  projectId,
  projectName,
  clientName,
  action,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  action: LifecycleAction;
}) {
  const close = useCloseModal();
  const [state, formAction, pending] = useActionState<ModalFormState, FormData>(action, undefined);
  useRedirectOnState(state);

  return (
    <>
      <ModalHeader title="Reject project" subtitle={`${projectName} · ${clientName}`} onClose={close} />
      <form action={formAction} className="od-modal-body">
        <input type="hidden" name="projectId" value={projectId} />
        <div>
          <label className="od-lab">Rejected by</label>
          <div className="od-seg">
            <label style={{ flex: 1, margin: 0 }}>
              <input type="radio" name="rejectedBy" value="you" defaultChecked className="od-seg-radio" />
              <span className="od-seg-opt">You</span>
            </label>
            <label style={{ flex: 1, margin: 0 }}>
              <input type="radio" name="rejectedBy" value="client" className="od-seg-radio" />
              <span className="od-seg-opt">Client</span>
            </label>
          </div>
        </div>
        <div>
          <label className="od-lab" htmlFor="rejectionReason">Reason</label>
          <textarea id="rejectionReason" name="rejectionReason" className="od-input" required />
        </div>
        {state?.error && <p className="text-[12px]" style={{ color: "var(--od-red)" }}>{state.error}</p>}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
            <button type="submit" disabled={pending} className="od-btn od-btn-danger" style={{ border: "1px solid var(--od-red)" }}>
              {pending ? "Rejecting…" : "Reject project"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
