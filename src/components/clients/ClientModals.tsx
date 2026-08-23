"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { ClientForm, type ClientDefaults } from "@/components/clients/ClientForm";
import { createClientAction, updateClientAction, type FormState } from "@/lib/actions/clients";
import { formatDateShort } from "@/lib/format";

/** Superset of lib/actions/clients' FormState — offline write functions add
 * `redirectTo` since there's no server-side redirect() to rely on. */
type ModalFormState = { error?: string; redirectTo?: string } | undefined;
type ClientAction = (state: ModalFormState, formData: FormData) => Promise<ModalFormState>;

export function NewClientModal({ action = createClientAction }: { action?: ClientAction }) {
  return (
    <QueryModal param="new" value="1">
      <NewClientModalContent action={action} />
    </QueryModal>
  );
}

function NewClientModalContent({ action }: { action: ClientAction }) {
  const router = useRouter();
  const pathname = usePathname();

  function close() {
    router.push(pathname);
  }

  return (
    <>
      <ModalHeader title="Add client" subtitle="Add starts empty — only company name is required." onClose={close} />
      <div className="od-modal-body">
        <ClientForm action={action} submitLabel="Save client" onRedirect={(to) => router.push(to)} />
      </div>
    </>
  );
}

export function EditClientModal({
  client,
  showNoteField = true,
  action = updateClientAction,
}: {
  client: ClientDefaults & { id: string };
  showNoteField?: boolean;
  action?: ClientAction;
}) {
  return (
    <QueryModal param="edit" value="1">
      <EditClientModalContent client={client} showNoteField={showNoteField} action={action} />
    </QueryModal>
  );
}

function EditClientModalContent({
  client,
  showNoteField,
  action,
}: {
  client: ClientDefaults & { id: string };
  showNoteField: boolean;
  action: ClientAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("edit");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <ModalHeader
        title="Edit client"
        subtitle={
          client.createdAt
            ? `${client.companyName} — added ${formatDateShort(client.createdAt)}`
            : client.companyName
        }
        onClose={close}
      />
      <div className="od-modal-body">
        <ClientForm
          action={action}
          defaults={client}
          submitLabel="Save changes"
          showNoteField={showNoteField}
          onRedirect={(to) => router.push(to)}
        />
      </div>
    </>
  );
}
