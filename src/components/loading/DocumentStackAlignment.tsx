/** Loading treatment for a single project/client's data: offset document
 * cards settle into a stack with a folder forming around them. Purely
 * presentational — timing is the caller's job (see useDelayedPending). */
export function DocumentStackAlignment() {
  return (
    <div className="od-loading-doc-stack" role="status" aria-label="Loading">
      <span className="od-loading-doc-folder" aria-hidden="true" />
      <span className="od-loading-doc-card" aria-hidden="true" />
      <span className="od-loading-doc-card" aria-hidden="true" />
      <span className="od-loading-doc-card" aria-hidden="true" />
      <span className="od-loading-doc-card" aria-hidden="true" />
    </div>
  );
}
