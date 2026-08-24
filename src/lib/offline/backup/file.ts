/** File System Access API isn't in TS's default DOM lib yet — minimal local
 * typings for just the bit used here, feature-detected at runtime since
 * only Chromium browsers implement it. Everything else falls back to a
 * plain <a download> / <input type=file> click, which is also what
 * Firefox/Safari get. No persistent folder-handle caching (yet) — every
 * backup/restore re-prompts for a location or file. */
interface FileSystemFileHandleLike {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  getFile(): Promise<File>;
}
type ShowSaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandleLike>;
type ShowOpenFilePicker = (options: {
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandleLike[]>;

const BACKUP_FILE_TYPES = [{ description: "Orbit Desk backup", accept: { "application/json": [".json"] } }];

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export async function downloadBackupFile(json: string, filename: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: filename, types: BACKUP_FILE_TYPES });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (e) {
      if (isAbort(e)) return;
      // Fall through to the download fallback on anything else (e.g. no
      // permission, feature disabled by policy).
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function pickBackupFile(): Promise<File | null> {
  const picker = (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker }).showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker({ types: BACKUP_FILE_TYPES });
      return handle ? await handle.getFile() : null;
    } catch (e) {
      if (isAbort(e)) return null;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
