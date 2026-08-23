"use client";

import { useActionState } from "react";
import { signInAction } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-[13px]">
      <div>
        <label className="od-lab" htmlFor="signin-email">
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="od-input"
          placeholder="you@studio.com"
        />
      </div>
      <div>
        <label className="od-lab" htmlFor="signin-password">
          Password
        </label>
        <PasswordInput
          id="signin-password"
          name="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state?.error && (
        <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="od-btn od-btn-p">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
