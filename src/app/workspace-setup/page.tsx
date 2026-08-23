import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceSetupForm } from "@/components/onboarding/WorkspaceSetupForm";
import { skipWorkspaceSetupAction } from "@/lib/actions/workspace";
import { isOfflineMode } from "@/lib/offline/mode";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

export const metadata: Metadata = { title: "Set up your workspace — Orbit Desk" };

export default function WorkspaceSetupPage() {
  // Offline mode auto-provisions a workspace at sign-up — no guided setup.
  if (isOfflineMode()) redirect("/overview");

  return (
    <div className="od-shell">
      <nav className="od-nav">
        <span className="od-brand">
          <BrandMark />
          <BrandWordmark />
        </span>
        <div className="flex items-center gap-[14px]" style={{ marginLeft: "auto" }}>
          <div className="flex gap-[5px]">
            <span style={{ width: 28, height: 4, background: "var(--od-rustic)" }} />
            <span style={{ width: 28, height: 4, background: "var(--od-oak)" }} />
            <span style={{ width: 28, height: 4, background: "var(--od-oak)" }} />
          </div>
          <span className="od-kick">Step 1 of 3</span>
        </div>
      </nav>
      <div className="flex flex-1 items-center justify-center p-9">
        <div className="flex w-full max-w-[560px] flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <h2>Set up your workspace</h2>
            <p className="od-muted text-[13.5px] leading-[1.6]">
              Four things, all changeable later. Skip and Orbit Desk will use sensible
              defaults.
            </p>
          </div>
          <WorkspaceSetupForm skipAction={skipWorkspaceSetupAction} />
        </div>
      </div>
    </div>
  );
}
