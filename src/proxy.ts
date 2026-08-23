import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOfflineMode } from "@/lib/offline/mode";

const PUBLIC_PATHS = ["/sign-in"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth(async (req) => {
  // Offline mode has no server-side session (NextAuth/Postgres are unused)
  // — route gating happens client-side instead, inside AppShell.
  if (isOfflineMode()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (!session?.user?.id) {
    if (isPublicPath(pathname)) return NextResponse.next();
    const signInUrl = new URL("/sign-in", req.url);
    if (pathname !== "/") signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already signed in: bounce away from the sign-in screen.
  if (isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/overview", req.url));
  }

  // Workspace-setup itself, and its guided first-run steps, are always reachable
  // once signed in — the guard below only protects the rest of the app.
  if (pathname === "/workspace-setup" || pathname.startsWith("/workspace-setup/")) {
    return NextResponse.next();
  }

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.redirect(new URL("/workspace-setup", req.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/overview", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
