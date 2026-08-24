"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { exportWorkspaceBackup, backupFilename } from "@/lib/offline/backup/export";
import { downloadBackupFile } from "@/lib/offline/backup/file";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";

export function BackupModal() {
  return (
    <QueryModal param="backup" value="1">
      <BackupModalContent />
    </QueryModal>
  );
}

type Status = "idle" | "working" | "done" | "error";

function BackupModalContent() {
  const { workspace } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");

  function close() {
    router.push(pathname);
  }

  async function onBackup() {
    setStatus("working");
    try {
      const backup = await exportWorkspaceBackup(workspace.id);
      const json = JSON.stringify(backup, null, 2);
      await downloadBackupFile(json, backupFilename(workspace.name, backup.exportedAt));
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <ModalHeader title="Backup workspace" subtitle={workspace.name} onClose={close} />
      <div className="od-modal-body">
        <p className="od-muted text-[13px] leading-[1.6]">
          Downloads everything in this workspace — clients, projects, collaborators, payments, and
          the relationship log — as a single JSON file. Nothing leaves this device.
        </p>
        {status === "done" && (
          <p className="text-[12.5px]" style={{ color: "var(--od-green)" }}>Backup downloaded.</p>
        )}
        {status === "error" && (
          <p className="text-[12px]" style={{ color: "var(--od-red)" }}>Couldn&apos;t create the backup. Try again.</p>
        )}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
          <div className="flex gap-[9px]">
            <button type="button" onClick={close} className="od-btn od-btn-s">
              {status === "done" ? "Done" : "Cancel"}
            </button>
            {status !== "done" && (
              <button type="button" onClick={onBackup} disabled={status === "working"} className="od-btn od-btn-p">
                {status === "working" ? "Preparing…" : "Download backup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
