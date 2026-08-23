const TONE = {
  active: { cls: "od-t-active", dot: "var(--od-green)" },
  pending: { cls: "od-t-pending", dot: "var(--od-yellow)" },
  rejected: { cls: "od-t-rejected", dot: "var(--od-red)" },
  done: { cls: "od-t-done", dot: "var(--od-neutral-pos)" },
} as const;

export type Tone = keyof typeof TONE;

/** Onboarding status → tag tone. */
export function onboardingTone(status: "pending" | "onboarded" | "rejected"): Tone {
  if (status === "onboarded") return "active";
  if (status === "rejected") return "rejected";
  return "pending";
}

/** Project stage → tag tone + label. */
export function stageTone(
  stage: "pending" | "active" | "built" | "transferred" | "completed" | "rejected"
): { tone: Tone; label: string } {
  switch (stage) {
    case "active":
      return { tone: "active", label: "Active" };
    case "pending":
      return { tone: "pending", label: "Pending" };
    case "rejected":
      return { tone: "rejected", label: "Rejected" };
    case "built":
      return { tone: "done", label: "Built" };
    case "transferred":
      return { tone: "done", label: "Transferred" };
    case "completed":
      return { tone: "done", label: "Completed" };
  }
}

export function StatusTag({ tone, label }: { tone: Tone; label: string }) {
  const t = TONE[tone];
  return (
    <span className={`od-tag ${t.cls}`}>
      <span className="od-dot" style={{ background: t.dot }} />
      {label}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <span className="od-dot" style={{ background: TONE[tone].dot }} />;
}
