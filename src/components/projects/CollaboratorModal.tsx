"use client";

import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { addCollaboratorAction } from "@/lib/actions/projects";

export function CollaboratorModal({
  projectId,
  action = addCollaboratorAction,
}: {
  projectId: string;
  action?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <QueryModal param="collaborator" value="1">
      <CollaboratorForm projectId={projectId} action={action} />
    </QueryModal>
  );
}

function CollaboratorForm({
  projectId,
  action,
}: {
  projectId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const close = () => router.push(pathname);

  return (
    <>
      <ModalHeader title="Add collaborator" subtitle="A named person and a role label — not a login." onClose={close} />
      <form action={action} className="od-modal-body">
        <input type="hidden" name="projectId" value={projectId} />
        <div>
          <label className="od-lab" htmlFor="collab-name">Name</label>
          <input id="collab-name" name="name" className="od-input" required />
        </div>
        <div>
          <label className="od-lab" htmlFor="collab-role">Role</label>
          <input id="collab-role" name="role" className="od-input" placeholder="PM, Designer, Primary contact…" />
        </div>
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
            <button type="submit" className="od-btn od-btn-p">Add collaborator</button>
          </div>
        </div>
      </form>
    </>
  );
}
