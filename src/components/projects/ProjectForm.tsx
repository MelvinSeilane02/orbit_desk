"use client";

import { useActionState, useEffect } from "react";
import { ClientSearchInput } from "@/components/projects/ClientSearchInput";

/** Superset of lib/actions/projects' FormState — offline write functions
 * add `redirectTo` since there's no server-side redirect() to rely on. */
type FormState = { error?: string; redirectTo?: string } | undefined;

export function ProjectForm({
  action,
  clients,
  defaultClientId,
  defaultStage = "active",
  guided = false,
  submitLabel = "Create project",
  onRedirect,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  clients: Array<{ id: string; companyName: string }>;
  defaultClientId?: string;
  defaultStage?: "pending" | "active";
  guided?: boolean;
  submitLabel?: string;
  /** Offline-only: called when the write function returns `redirectTo`. */
  onRedirect?: (to: string) => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.redirectTo) onRedirect?.(state.redirectTo);
  }, [state, onRedirect]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {guided && <input type="hidden" name="guided" value="1" />}
      <div>
        <label className="od-lab" htmlFor="pname">
          Project name
        </label>
        <input
          id="pname"
          name="name"
          className="od-input"
          style={{ borderColor: "var(--od-rustic)" }}
          required
        />
      </div>
      <div>
        <span className="od-lab">Client</span>
        <ClientSearchInput label="Client" clients={clients} defaultClientId={defaultClientId} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="od-lab" htmlFor="pprice">
            Fixed price
          </label>
          <input
            id="pprice"
            name="fixedPrice"
            type="number"
            min={0}
            step="0.01"
            className="od-input"
            placeholder="0"
          />
        </div>
        <div className="flex-1">
          <label className="od-lab" htmlFor="pstage">
            Stage
          </label>
          <select id="pstage" name="stage" className="od-input" defaultValue={defaultStage}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>

      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="od-btn od-btn-p"
        style={{ alignSelf: "flex-start" }}
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
