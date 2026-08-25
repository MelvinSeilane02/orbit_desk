"use client";

import { useActionState, useEffect } from "react";
import { offlineSignIn, offlineSignUp } from "@/lib/offline/writes/auth";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

/** Offline mode's entire "auth" screen: no password, no server — just a
 * local profile (Name/Surname/Username) stored in IndexedDB. Security is
 * explicitly deferred to v2 (see WHAT_WAS_BUILT.md). */
export function OfflineAuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div
        className="flex flex-1 flex-col items-center justify-center gap-[14px] p-9"
        style={{ background: "var(--od-bg)", borderRight: "1px solid var(--od-rule-2)" }}
      >
        <span className="od-kick w-full max-w-[360px] self-center">Returning</span>
        <div
          className="w-full max-w-[360px] flex flex-col gap-[18px] p-[26px]"
          style={{ background: "var(--od-surface)", border: "1px solid var(--od-rule-2)" }}
        >
          <div className="flex flex-col gap-3">
            <span className="od-brand text-[17px]">
              <BrandMark />
              <BrandWordmark />
            </span>
            <h4>Welcome back</h4>
            <p className="od-muted text-[12.5px] leading-[1.5]">
              Offline mode — this device only. Enter your username, no password needed.
            </p>
            <p className="text-[11.5px] leading-[1.5]" style={{ color: "var(--od-brass)" }}>
              Tip: back up your workspace from the account menu regularly — if this
              browser&apos;s storage is ever cleared, anything not backed up is gone for good.
            </p>
          </div>
          <SignInForm onSignedIn={onSignedIn} />
        </div>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center gap-[14px] p-9"
        style={{ background: "linear-gradient(180deg, #1b1614 0%, var(--od-bg) 100%)" }}
      >
        <span className="od-kick w-full max-w-[376px] self-center">New</span>
        <div className="w-full max-w-[376px] flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <h3>Simple enough to use every day.</h3>
            <p className="od-muted text-[13.5px] leading-[1.6]">
              Set up a local profile — your data stays in this browser, nothing leaves
              your device. Back it up from the account menu once you&apos;re in, so a
              cleared browser or a new device doesn&apos;t lose it.
            </p>
          </div>
          <hr className="od-rule" />
          <SignUpForm onSignedIn={onSignedIn} />
        </div>
      </div>
    </div>
  );
}

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [state, formAction, pending] = useActionState(offlineSignIn, undefined);

  useEffect(() => {
    if (state?.redirectTo) onSignedIn();
  }, [state, onSignedIn]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="od-lab" htmlFor="signin-username">
          Username
        </label>
        <input
          id="signin-username"
          name="username"
          className="od-input"
          style={{ borderColor: "var(--od-rustic)" }}
          autoComplete="username"
          required
        />
      </div>
      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="od-btn od-btn-p" style={{ alignSelf: "flex-start" }}>
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}

function SignUpForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [state, formAction, pending] = useActionState(offlineSignUp, undefined);

  useEffect(() => {
    if (state?.redirectTo) onSignedIn();
  }, [state, onSignedIn]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="od-lab" htmlFor="signup-name">
            Name
          </label>
          <input id="signup-name" name="name" className="od-input" required />
        </div>
        <div className="flex-1">
          <label className="od-lab" htmlFor="signup-surname">
            Surname
          </label>
          <input id="signup-surname" name="surname" className="od-input" required />
        </div>
      </div>
      <div>
        <label className="od-lab" htmlFor="signup-username">
          Username
        </label>
        <input
          id="signup-username"
          name="username"
          className="od-input"
          style={{ borderColor: "var(--od-rustic)" }}
          autoComplete="username"
          required
        />
      </div>
      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="od-btn od-btn-p" style={{ alignSelf: "flex-start" }}>
        {pending ? "Setting up…" : "Create local profile"}
      </button>
      <span className="text-[11px] leading-[1.5]" style={{ color: "var(--od-placeholder)" }}>
        No password, no account — this is a local profile stored only in this browser.
      </span>
    </form>
  );
}
