import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isGoogleAuthEnabled } from "@/auth";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { isOfflineMode } from "@/lib/offline/mode";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

export const metadata: Metadata = { title: "Sign in — Orbit Desk" };

// Google sign-in is temporarily hidden from the UI — flip this back to
// `true` to bring it back. The component and its call sites below stay in
// place so re-enabling is a one-line change.
const SHOW_GOOGLE_SIGNIN = false;

export default function SignInPage() {
  // Offline mode's sign-in/sign-up screen lives inside AppShell (it's a
  // gate, not a route) so a stray visit here just bounces into the app.
  if (isOfflineMode()) redirect("/overview");

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
          </div>
          <SignInForm />
          {SHOW_GOOGLE_SIGNIN && <GoogleButton enabled={isGoogleAuthEnabled} />}
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
              Professional enough to run a business. Clients, projects and pricing in
              one cabinet — no CRM, no setup weekend.
            </p>
          </div>
          <hr className="od-rule" />
          <SignUpForm />
          {SHOW_GOOGLE_SIGNIN && <GoogleButton enabled={isGoogleAuthEnabled} />}
          <span className="text-[11px] leading-[1.5]" style={{ color: "var(--od-placeholder)" }}>
            No card needed. Orbit Desk is by Orbit.
          </span>
        </div>
      </div>
    </div>
  );
}
