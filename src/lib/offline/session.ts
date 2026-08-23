/** Current signed-in local user id lives in sessionStorage, not IndexedDB:
 * it's cleared when the browser tab/session ends, so offline mode asks you
 * to sign in again each new session but keeps you in across reloads within
 * one — there is deliberately no password check behind this (v2 concern). */
const KEY = "orbit-desk-offline-user-id";

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCurrentUserId(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, userId);
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

export function clearCurrentUserId(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
