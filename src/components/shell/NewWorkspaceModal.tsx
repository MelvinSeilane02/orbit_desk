"use client";

import { useActionState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { createWorkspace } from "@/lib/offline/writes/workspace";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";

export function NewWorkspaceModal() {
  return (
    <QueryModal param="newWorkspace" value="1">
      <NewWorkspaceModalContent />
    </QueryModal>
  );
}

function NewWorkspaceModalContent() {
  const { user } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  const action = (state: Awaited<ReturnType<typeof createWorkspace>>, formData: FormData) =>
    createWorkspace(user.id, state, formData);
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  function close() {
    router.push(pathname);
  }

  return (
    <>
      <ModalHeader title="New workspace" subtitle="Starts empty — no demo data." onClose={close} />
      <div className="od-modal-body">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className="od-lab" htmlFor="new-workspace-name">
              Workspace name
            </label>
            <input id="new-workspace-name" name="name" className="od-input" required autoFocus />
          </div>
          {state?.error && (
            <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending} className="od-btn od-btn-p" style={{ alignSelf: "flex-start" }}>
            {pending ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </>
  );
}
