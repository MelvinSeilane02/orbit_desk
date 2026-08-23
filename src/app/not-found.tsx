import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";

export default function RootNotFound() {
  return (
    <div className="od-shell">
      <nav className="od-nav">
        <span className="od-brand">
          <BrandMark />
          <BrandWordmark />
        </span>
      </nav>
      <div className="flex flex-1 items-center justify-center p-9">
        <div className="flex max-w-[520px] flex-col gap-[18px]">
          <span className="od-plate">Error 404</span>
          <h2>That drawer isn&apos;t here.</h2>
          <p className="od-muted text-[13.5px] leading-[1.65]">
            The page you asked for doesn&apos;t exist. Sign in to pick up where you left
            off, or check the address.
          </p>
          <hr className="od-rule" />
          <Link href="/sign-in" className="od-btn od-btn-p" style={{ alignSelf: "flex-start" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
