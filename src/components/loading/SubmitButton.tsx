"use client";

import { useFormStatus } from "react-dom";
import { useDelayedPending } from "@/lib/loading/useDelayedPending";
import { OakGrainSweep } from "@/components/loading/OakGrainSweep";

/** Drop-in replacement for a bare `<button type="submit">` inside a
 * `<form action={...}>` — tracks the form's pending state (works for both
 * server actions and offline write functions bound via
 * `action={(fd) => fn(...)}`, since useFormStatus tracks any function
 * passed to a form's action prop) and swaps the label for the branded
 * inline sweep instead of just disabling silently. */
export function SubmitButton({
  children,
  className,
  style,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  const visible = useDelayedPending(pending);

  return (
    <button type="submit" formAction={formAction} disabled={pending} className={className} style={style}>
      {visible ? <OakGrainSweep variant="inline" /> : children}
    </button>
  );
}
