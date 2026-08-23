/** The Orbit Desk brand icon — replaces the old CSS-drawn placeholder
 * square. Sized via the `.od-mark` class already used everywhere the mark
 * appears (nav bars, sign-in, workspace-setup steps, 404). */
export function BrandMark({ className = "od-mark" }: { className?: string }) {
  return <img src="/icons/Brand_logo_icon.png" alt="" className={className} />;
}

/** "Orbit Desk" with "Desk" in the brand's brown accent, matching the
 * wordmark lockup — used everywhere the logotype appears next to
 * `BrandMark`. Plain-text contexts (page titles, prose mentions) keep the
 * literal string instead, since a `<title>` can't carry color. */
export function BrandWordmark() {
  return (
    <>
      Orbit <span style={{ color: "var(--od-brass)" }}>Desk</span>
    </>
  );
}
