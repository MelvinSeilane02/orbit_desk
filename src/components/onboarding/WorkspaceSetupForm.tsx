"use client";

import { useActionState, useRef, useState } from "react";
import { createWorkspaceAction, type FormState } from "@/lib/actions/workspace";
import { SubmitButton } from "@/components/loading/SubmitButton";
import { CURRENCIES } from "@/lib/currencies";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

export function WorkspaceSetupForm({
  skipAction,
}: {
  skipAction: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createWorkspaceAction,
    undefined
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      <div className="od-card flex flex-col gap-[17px] p-6">
        <div>
          <label className="od-lab" htmlFor="ws-name">
            Workspace name
          </label>
          <input
            id="ws-name"
            name="name"
            className="od-input"
            placeholder="e.g. Reed Interactive"
            required
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="od-lab" htmlFor="ws-currency">
              Default currency
            </label>
            <select id="ws-currency" name="currency" className="od-input" defaultValue="USD">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="od-lab" htmlFor="ws-timezone">
              Timezone
            </label>
            <select
              id="ws-timezone"
              name="timezone"
              className="od-input"
              defaultValue="America/New_York"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="od-lab">Logo — optional</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="od-input-dashed od-input flex items-center gap-[14px]"
            style={{ height: "auto", padding: 14 }}
          >
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="" style={{ width: 46, height: 46, objectFit: "cover" }} />
            ) : (
              <span style={{ width: 46, height: 46, background: "var(--od-oak)", flex: "none" }} />
            )}
            <span className="text-[12.5px] leading-[1.5]">
              {logoDataUrl ? "Change image" : "Drop an image, or browse"}
              <br />
              <span className="od-muted">PNG or SVG, up to 2 MB. Shows in the top bar.</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={onFile}
          />
          <input type="hidden" name="logoUrl" value={logoDataUrl ?? ""} />
        </div>
      </div>

      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <SubmitButton formAction={skipAction} className="od-btn od-btn-g">
          Skip for now
        </SubmitButton>
        <button type="submit" disabled={pending} className="od-btn od-btn-p">
          {pending ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
