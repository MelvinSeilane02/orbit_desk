"use client";

import { useActionState } from "react";
import { signUpAction } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-[13px]">
      <div>
        <label className="od-lab" htmlFor="signup-name">
          Your name
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="od-input"
          placeholder="Marcus Reed"
        />
      </div>
      <div>
        <label className="od-lab" htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="od-input"
          placeholder="you@studio.com"
        />
      </div>
      <div>
        <label className="od-lab" htmlFor="signup-password">
          Password
        </label>
        <PasswordInput
          id="signup-password"
          name="password"
          required
          minLength={10}
          autoComplete="new-password"
          placeholder="At least 10 characters"
        />
      </div>
      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="od-btn od-btn-p">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
