/** Default loading treatment: small async operations and page transitions.
 * `variant="inline"` sizes to sit inside a button; `variant="block"` fills
 * a content container. Purely presentational — timing is the caller's job
 * (see useDelayedPending). */
export function OakGrainSweep({ variant = "block" }: { variant?: "block" | "inline" }) {
  if (variant === "inline") {
    return <span className="od-loading-oak-sweep od-loading-oak-sweep--inline" aria-hidden="true" />;
  }
  return (
    <div className="od-loading-block" role="status" aria-label="Loading">
      <span className="od-loading-oak-sweep od-loading-oak-sweep--block" aria-hidden="true" />
    </div>
  );
}
