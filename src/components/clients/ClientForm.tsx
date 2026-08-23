"use client";

import { useActionState, useEffect } from "react";

/** Superset of lib/actions/clients' FormState — offline write functions add
 * `redirectTo` since there's no server-side redirect() to rely on. Online
 * actions never set it, so `onRedirect` is simply never called for them. */
type FormState = { error?: string; redirectTo?: string } | undefined;

export type ClientDefaults = {
  id?: string;
  companyName?: string;
  primaryContact?: string | null;
  email?: string | null;
  phone?: string | null;
  onboardingStatus?: "pending" | "onboarded" | "rejected";
  createdAt?: Date | string | number;
};

const SEGMENTS: Array<{ value: "pending" | "onboarded" | "rejected"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "onboarded", label: "Onboarded" },
  { value: "rejected", label: "Rejected" },
];

export function ClientForm({
  action,
  defaults,
  redirectTo,
  guided,
  hiddenFields,
  submitLabel = "Save client",
  showNoteField = false,
  onRedirect,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ClientDefaults;
  redirectTo?: string;
  guided?: boolean;
  hiddenFields?: Record<string, string>;
  submitLabel?: string;
  showNoteField?: boolean;
  /** Offline-only: called when the write function returns `redirectTo`
   * instead of throwing a server-side redirect(). */
  onRedirect?: (to: string) => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const status = defaults?.onboardingStatus ?? "pending";

  useEffect(() => {
    if (state?.redirectTo) onRedirect?.(state.redirectTo);
  }, [state, onRedirect]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {defaults?.id && <input type="hidden" name="clientId" value={defaults.id} />}
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      {guided && <input type="hidden" name="guided" value="1" />}
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div>
        <label className="od-lab" htmlFor="companyName">
          Company name
        </label>
        <input
          id="companyName"
          name="companyName"
          className="od-input"
          style={defaults?.id ? undefined : { borderColor: "var(--od-rustic)" }}
          defaultValue={defaults?.companyName}
          required
        />
      </div>
      <div>
        <label className="od-lab" htmlFor="primaryContact">
          Primary contact
        </label>
        <input
          id="primaryContact"
          name="primaryContact"
          className="od-input"
          defaultValue={defaults?.primaryContact ?? ""}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="od-lab" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="od-input"
            defaultValue={defaults?.email ?? ""}
          />
        </div>
        <div style={{ width: 158, flex: "none" }}>
          <label className="od-lab" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            className="od-input"
            placeholder="Optional"
            defaultValue={defaults?.phone ?? ""}
          />
        </div>
      </div>

      {defaults?.id && (
        <div>
          <label className="od-lab">Onboarding status</label>
          <ClientOnboardingSegments defaultValue={status} />
        </div>
      )}

      {showNoteField && (
        <div>
          <label className="od-lab" htmlFor="note">
            Notes — goes to the top of the relationship log
          </label>
          <textarea
            id="note"
            name="note"
            className="od-input"
            placeholder="Anything worth remembering next time you speak"
          />
        </div>
      )}

      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="od-btn od-btn-p" style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function ClientOnboardingSegments({ defaultValue }: { defaultValue: string }) {
  return (
    <div className="od-seg">
      {SEGMENTS.map((s) => (
        <label key={s.value} style={{ flex: 1, margin: 0 }}>
          <input
            type="radio"
            name="onboardingStatus"
            value={s.value}
            defaultChecked={defaultValue === s.value}
            className="od-seg-radio"
          />
          <span className="od-seg-opt">{s.label}</span>
        </label>
      ))}
    </div>
  );
}
