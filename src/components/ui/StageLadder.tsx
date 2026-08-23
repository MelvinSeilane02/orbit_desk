const STAGES = ["pending", "active", "built", "transferred", "completed"] as const;
const LABELS: Record<(typeof STAGES)[number], string> = {
  pending: "Pending",
  active: "Active",
  built: "Built",
  transferred: "Transferred",
  completed: "Completed",
};
const MOBILE_LABELS: Record<(typeof STAGES)[number], string> = {
  pending: "Pend",
  active: "Active",
  built: "Built",
  transferred: "Trans",
  completed: "Done",
};

export function StageLadder({
  stage,
  compact = false,
}: {
  stage: (typeof STAGES)[number];
  compact?: boolean;
}) {
  const currentIndex = STAGES.indexOf(stage);

  return (
    <div className="od-ladder" style={{ gap: compact ? 4 : 0 }}>
      {STAGES.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const size = current ? (compact ? 11 : 12) : compact ? 8 : 9;

        return (
          <div key={s} className="flex items-center" style={{ flex: 1 }}>
            <div className="od-ladder-step">
              <span
                className="od-sq"
                style={{
                  width: size,
                  height: size,
                  background: done || current ? "var(--od-brass)" : "transparent",
                  border: done || current ? "none" : "1px solid var(--od-rule-2)",
                  ...(current
                    ? {
                        background: "var(--od-rustic)",
                        boxShadow: `0 0 0 3px rgba(138,94,60,.3)`,
                      }
                    : {}),
                }}
              />
              <span
                style={{
                  fontSize: compact ? 9 : 10.5,
                  fontWeight: current ? 800 : 400,
                  color: done ? "var(--od-muted)" : current ? "var(--od-text)" : "#6d635b",
                }}
              >
                {compact ? MOBILE_LABELS[s] : LABELS[s]}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <span
                className="od-ladder-rule"
                style={{
                  background: done ? "var(--od-brass)" : "var(--od-rule-2)",
                  opacity: done ? 0.6 : 1,
                  marginBottom: compact ? 15 : 19,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
