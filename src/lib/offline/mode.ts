/** Build-time flag: NEXT_PUBLIC_ so it's readable in both server and client
 * code (edge middleware, Server Components, Client Components alike). */
export const OFFLINE_MODE: boolean = process.env.NEXT_PUBLIC_OFFLINE_MODE === "true";

export function isOfflineMode(): boolean {
  return OFFLINE_MODE;
}
