"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryModal } from "@/components/ui/QueryModal";
import { ModalHeader } from "@/components/ui/Modal";
import { OakGrainSweep } from "@/components/loading/OakGrainSweep";
import { exportWorkspaceBackup, backupFilename } from "@/lib/offline/backup/export";
import { downloadBackupFile } from "@/lib/offline/backup/file";
import { useOfflineWorkspace } from "@/lib/offline/WorkspaceProvider";

/** Replaces the old standalone "Backup workspace" menu entry — backing up
 * is now offered at the one moment it actually matters, right before the
 * data would otherwise become unreachable (sign-out drops back to the
 * sign-in screen). Choosing to back up runs the same export used to,
 * downloads it, then signs out automatically once it's done; choosing
 * to skip signs out immediately. Closing the overlay (X, backdrop,
 * Escape) cancels — neither happens. */
export function SignOutConfirmModal() {
  return (
    <QueryModal param="signout" value="1">
      <SignOutConfirmContent />
    </QueryModal>
  );
}

type Status = "idle" | "backing-up" | "error";

function SignOutConfirmContent() {
  const { workspace, signOut } = useOfflineWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");

  function close() {
    router.push(pathname);
  }

  async function onBackupAndSignOut() {
    setStatus("backing-up");
    try {
      const backup = await exportWorkspaceBackup(workspace.id);
      const json = JSON.stringify(backup, null, 2);
      await downloadBackupFile(json, backupFilename(workspace.name, backup.exportedAt));
      signOut();
    } catch {
      setStatus("error");
    }
  }

  const busy = status === "backing-up";

  return (
    <>
      <ModalHeader title="Sign out" subtitle={workspace.name} onClose={close} />
      <div className="od-modal-body">
        <p className="od-muted text-[13px] leading-[1.6]">
          Back up this workspace before you go? It only lives in this browser — a backup
          file is the only copy that survives a cleared browser or a new device.
        </p>
        {status === "error" && (
          <p className="text-[12px]" style={{ color: "var(--od-red)" }}>
            Couldn&apos;t create the backup. Try again, or sign out without one.
          </p>
        )}
        <div className="od-modal-foot" style={{ margin: "0 -24px -20px", justifyContent: "flex-end" }}>
          <div className="flex gap-[9px]">
            <button type="button" onClick={signOut} disabled={busy} className="od-btn od-btn-s">
              Sign out
            </button>
            <button
              type="button"
              onClick={onBackupAndSignOut}
              disabled={busy}
              className="od-btn od-btn-p flex items-center gap-[8px]"
            >
              {busy ? <OakGrainSweep variant="inline" /> : "Backup and sign out"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
