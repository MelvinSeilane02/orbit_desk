"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { createProjectAction, updateProjectAction } from "@/lib/actions/projects";
import { useActionState, useEffect } from "react";

type ModalFormState = { error?: string; redirectTo?: string } | undefined;
type ProjectAction = (state: ModalFormState, formData: FormData) => Promise<ModalFormState>;

export function NewProjectModal({
  clients,
  action = createProjectAction,
}: {
  clients: Array<{ id: string; companyName: string }>;
  action?: ProjectAction;
}) {
  return (
    <QueryModal param="new" value="1">
      <NewProjectModalContent clients={clients} action={action} />
    </QueryModal>
  );
}

function NewProjectModalContent({
  clients,
  action,
}: {
  clients: Array<{ id: string; companyName: string }>;
  action: ProjectAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const close = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("new");
    next.delete("clientId");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const defaultClientId = searchParams.get("clientId") ?? undefined;

  return (
    <>
      <ModalHeader title="New project" subtitle="One client per project, plus optional collaborators later." onClose={close} />
      <div className="od-modal-body">
        <ProjectForm
          action={action}
          clients={clients}
          defaultClientId={defaultClientId}
          onRedirect={(to) => router.push(to)}
        />
      </div>
    </>
  );
}

export function EditProjectModal({
  project,
  action = updateProjectAction,
}: {
  project: { id: string; name: string; fixedPrice: string };
  action?: ProjectAction;
}) {
  return (
    <QueryModal param="edit" value="1">
      <EditProjectForm project={project} action={action} />
    </QueryModal>
  );
}

function EditProjectForm({
  project,
  action,
}: {
  project: { id: string; name: string; fixedPrice: string };
  action: ProjectAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const close = () => router.push(pathname);
  const [state, formAction, pending] = useActionState<ModalFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  return (
    <>
      <ModalHeader title="Edit project" onClose={close} />
      <form action={formAction} className="od-modal-body">
        <input type="hidden" name="projectId" value={project.id} />
        <div>
          <label className="od-lab" htmlFor="edit-pname">Project name</label>
          <input id="edit-pname" name="name" className="od-input" defaultValue={project.name} required />
        </div>
        <div>
          <label className="od-lab" htmlFor="edit-pprice">Fixed price</label>
          <input
            id="edit-pprice"
            name="fixedPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={project.fixedPrice}
            className="od-input"
          />
        </div>
        {state?.error && <p className="text-[12px]" style={{ color: "var(--od-red)" }}>{state.error}</p>}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
            <button type="submit" disabled={pending} className="od-btn od-btn-p">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
