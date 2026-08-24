"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { OakGrainSweep } from "@/components/loading/OakGrainSweep";
import { pickBackupFile } from "@/lib/offline/backup/file";
import { parseBackupFile, restoreWorkspaceBackup } from "@/lib/offline/backup/restore";
import type { BackupFile } from "@/lib/offline/backup/types";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";
import { formatDateShort } from "@/lib/format";

type Step =
  | { kind: "pick" }
  | { kind: "preview"; backup: BackupFile }
  | { kind: "restoring" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function RestoreModal() {
  return (
    <QueryModal param="restore" value="1">
      <RestoreModalContent />
    </QueryModal>
  );
}

function RestoreModalContent() {
  const { workspace } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<Step>({ kind: "pick" });

  function close() {
    router.push(pathname);
  }

  async function onPick() {
    const file = await pickBackupFile();
    if (!file) return;
    const raw = await file.text();
    const parsed = parseBackupFile(raw);
    if (!parsed.ok) {
      setStep({ kind: "error", message: parsed.error });
      return;
    }
    setStep({ kind: "preview", backup: parsed.backup });
  }

  async function onConfirmRestore(backup: BackupFile) {
    setStep({ kind: "restoring" });
    try {
      await restoreWorkspaceBackup(workspace.id, backup);
      setStep({ kind: "done" });
    } catch {
      setStep({ kind: "error", message: "Couldn't restore this backup. Nothing was changed." });
    }
  }

  return (
    <>
      <ModalHeader title="Restore workspace" subtitle={workspace.name} onClose={close} />
      <div className="od-modal-body">
        {step.kind === "pick" && (
          <>
            <p className="od-muted text-[13px] leading-[1.6]">
              Choose an Orbit Desk backup file. Restoring replaces everything currently in{" "}
              <strong>{workspace.name}</strong> — there&apos;s no undo, so back this workspace up
              first if you want to keep what&apos;s here now.
            </p>
            <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
              <div className="flex gap-[9px]">
                <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
                <button type="button" onClick={onPick} className="od-btn od-btn-p">Choose file…</button>
              </div>
            </div>
          </>
        )}

        {step.kind === "preview" && (
          <>
            <div className="od-card p-3 flex flex-col gap-[6px]" style={{ background: "var(--od-panel)" }}>
              <span className="text-[12.5px] font-extrabold">
                Backup from {formatDateShort(step.backup.exportedAt)}
              </span>
              <span className="od-muted text-[12px]">
                {step.backup.data.clients.length} clients · {step.backup.data.projects.length} projects ·{" "}
                {step.backup.data.payments.length} payments · {step.backup.data.timelineEvents.length} log entries
              </span>
            </div>
            <p className="text-[12.5px] leading-[1.6]" style={{ color: "var(--od-red)" }}>
              This replaces everything currently in {workspace.name}. This can&apos;t be undone.
            </p>
            <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
              <div className="flex gap-[9px]">
                <button type="button" onClick={close} className="od-btn od-btn-s">Cancel</button>
                <button
                  type="button"
                  onClick={() => onConfirmRestore(step.backup)}
                  className="od-btn od-btn-danger"
                  style={{ border: "1px solid var(--od-red)" }}
                >
                  Replace this workspace&apos;s data
                </button>
              </div>
            </div>
          </>
        )}

        {step.kind === "restoring" && <OakGrainSweep />}

        {step.kind === "done" && (
          <>
            <p className="text-[12.5px]" style={{ color: "var(--od-green)" }}>Restore complete.</p>
            <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
              <button type="button" onClick={close} className="od-btn od-btn-p">Done</button>
            </div>
          </>
        )}

        {step.kind === "error" && (
          <>
            <p className="text-[12.5px]" style={{ color: "var(--od-red)" }}>{step.message}</p>
            <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
              <div className="flex gap-[9px]">
                <button type="button" onClick={close} className="od-btn od-btn-s">Close</button>
                <button type="button" onClick={() => setStep({ kind: "pick" })} className="od-btn od-btn-p">Try again</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
