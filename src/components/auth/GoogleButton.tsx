import { signIn } from "@/auth";

export async function googleSignInAction() {
  "use server";
  await signIn("google", { redirectTo: "/workspace-setup" });
}

export function GoogleButton({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <button type="button" disabled className="od-btn od-btn-s" title="Google sign-in is not configured">
        Continue with Google
      </button>
    );
  }
  return (
    <form action={googleSignInAction}>
      <button type="submit" className="od-btn od-btn-s w-full">
        Continue with Google
      </button>
    </form>
  );
}
