import type { Metadata } from "next";
import { auth } from "@/auth";
import { requireWorkspace } from "@/lib/session";
import { getOverviewCounts, getAttentionItems } from "@/lib/data";
import { AttentionRow } from "@/components/projects/AttentionRow";
import { isOfflineMode } from "@/lib/offline/mode";
import { OfflineOverviewPage } from "./OfflineOverviewPage";

export const metadata: Metadata = { title: "Overview — Orbit Desk" };

export default async function OverviewPage() {
  if (isOfflineMode()) return <OfflineOverviewPage />;

  const workspace = await requireWorkspace();
  const session = await auth();
  const [counts, attention] = await Promise.all([
    getOverviewCounts(workspace.id),
    getAttentionItems(workspace.id),
  ]);

  const firstName = (session?.user?.name ?? "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const totalLiveProjects = counts.active + counts.built;

  return (
    <div className="od-pad flex flex-1 flex-col gap-6 overflow-y-auto">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h2>Good {timeOfDay()}, {firstName}</h2>
        <span className="od-kick">{today}</span>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ borderTop: "1px solid var(--od-rule-2)", borderBottom: "1px solid var(--od-rule-2)" }}
      >
        <CountCell label="Active" value={counts.active} sub="projects in flight" />
        <CountCell label="Built" value={counts.built} sub="awaiting transfer" color="var(--od-yellow)" />
        <CountCell
          label="Onboarding"
          value={counts.onboarding}
          sub="clients waiting on you"
          color="var(--od-yellow)"
        />
        <CountCell
          label="Rejected"
          value={counts.rejected}
          sub={counts.rejected > 0 ? "project, all clients out" : "nothing outstanding"}
          color="var(--od-red)"
          last
        />
      </div>

      {attention.length > 0 ? (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="od-plate" style={{ color: "#d78872", borderColor: "rgba(194,85,61,.45)" }}>
              Needs attention
            </span>
            <span className="od-muted text-[12px]">
              {attention.length} of {totalLiveProjects || attention.length} projects
            </span>
          </div>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-x-[14px]">
            {attention.map((a) => (
              <AttentionRow key={a.projectId} item={a} />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex flex-1 items-center justify-center"
          style={{
            border: "1px solid var(--od-rule)",
            background: "linear-gradient(180deg, var(--od-surface) 0%, #171312 100%)",
          }}
        >
          <div className="flex max-w-[440px] flex-col items-start gap-[11px] px-8">
            <span className="flex items-center gap-[9px]">
              <span className="od-dot" style={{ background: "var(--od-green)", width: 8, height: 8 }} />
              <span className="od-kick" style={{ color: "var(--od-green)" }}>
                All drawers closed
              </span>
            </span>
            <h3>Nothing needs your attention</h3>
            <p className="od-muted text-[13.5px] leading-[1.6]">
              Every project in flight is on track and every client is onboarded. Go and do
              the work.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function CountCell({
  label,
  value,
  sub,
  color,
  last = false,
}: {
  label: string;
  value: number;
  sub: string;
  color?: string;
  last?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-[5px] py-[17px]"
      style={{ borderRight: last ? undefined : "1px solid var(--od-rule)", paddingRight: 20, paddingLeft: 20 }}
    >
      <span className="od-kick">{label}</span>
      <span className="od-num" style={{ fontSize: 34, lineHeight: 1, color: color ?? undefined }}>
        {value}
      </span>
      <span className="od-muted text-[12px]">{sub}</span>
    </div>
  );
}
