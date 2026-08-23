"use client";

import { useActionState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { recordPaymentAction } from "@/lib/actions/projects";
import { formatMoney } from "@/lib/format";

type ModalFormState = { error?: string; redirectTo?: string } | undefined;
type PaymentAction = (state: ModalFormState, formData: FormData) => Promise<ModalFormState>;

export function PaymentModal({
  projectId,
  projectName,
  clientName,
  fixedPrice,
  paidTotal,
  outstanding,
  currency,
  action = recordPaymentAction,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  fixedPrice: number;
  paidTotal: number;
  outstanding: number;
  currency: string;
  action?: PaymentAction;
}) {
  return (
    <QueryModal param="payment" value="1">
      <PaymentForm
        projectId={projectId}
        projectName={projectName}
        clientName={clientName}
        fixedPrice={fixedPrice}
        paidTotal={paidTotal}
        outstanding={outstanding}
        currency={currency}
        action={action}
      />
    </QueryModal>
  );
}

function PaymentForm(props: {
  projectId: string;
  projectName: string;
  clientName: string;
  fixedPrice: number;
  paidTotal: number;
  outstanding: number;
  currency: string;
  action: PaymentAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState<ModalFormState, FormData>(props.action, undefined);

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  function close() {
    router.push(pathname);
  }

  const willBePaidInFull = props.outstanding <= 0;

  return (
    <>
      <ModalHeader title="Record a payment" subtitle={`${props.projectName} · ${props.clientName}`} onClose={close} />
      <form action={formAction} className="od-modal-body">
        <input type="hidden" name="projectId" value={props.projectId} />
        <div className="grid grid-cols-3" style={{ background: "var(--od-panel)", border: "1px solid var(--od-rule)" }}>
          <Cell label="Fixed price" value={formatMoney(props.fixedPrice, props.currency)} />
          <Cell label="Already paid" value={formatMoney(props.paidTotal, props.currency)} />
          <Cell label="Outstanding" value={formatMoney(props.outstanding, props.currency)} color="var(--od-yellow)" last />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="od-lab" htmlFor="amount">Amount</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              defaultValue={props.outstanding > 0 ? props.outstanding : undefined}
              className="od-input"
              style={{ borderColor: "var(--od-rustic)" }}
              required
            />
            <span style={{ fontSize: 10.5, color: "var(--od-brass)", marginTop: 5, display: "block" }}>
              Fill the outstanding balance
            </span>
          </div>
          <div style={{ width: 158, flex: "none" }}>
            <label className="od-lab" htmlFor="date">Date received</label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="od-input"
            />
          </div>
        </div>
        <div>
          <label className="od-lab" htmlFor="note">Note — optional</label>
          <textarea id="note" name="note" className="od-input" placeholder="Final invoice, bank transfer" />
        </div>
        {state?.error && (
          <p className="text-[12px]" style={{ color: "var(--od-red)" }}>{state.error}</p>
        )}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px" }}>
          <span className="text-[11.5px]" style={{ color: willBePaidInFull ? "var(--od-green)" : "transparent" }}>
            Paid in full after this
          </span>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
            <button type="submit" disabled={pending} className="od-btn od-btn-p">
              {pending ? "Recording…" : "Record payment"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function Cell({ label, value, color, last = false }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px] p-[11px]" style={{ borderRight: last ? undefined : "1px solid var(--od-rule)" }}>
      <span className="od-kick" style={{ fontSize: 9 }}>{label}</span>
      <span className="od-num" style={{ fontSize: 14, color }}>{value}</span>
    </div>
  );
}
