# What was built

Orbit Desk is a full-stack, multi-user project-tracking app for a solo
freelance developer to manage clients, projects, payments, and handoffs.
Built from `Orbit Desk - Master Build Spec.md` (UI/UX, copy, data shape)
and `Orbit Desk Screens (standalone).html` (pixel-accurate design system),
with the multi-user auth/database architecture adapted from
`orbit-desk-master-build-prompt.md`. Where the two specs disagreed, the
settled Master Build Spec and screens won on UI, copy, and field names.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **PostgreSQL + Prisma 7**, via `@prisma/adapter-pg` (Prisma 7 requires an
  explicit driver adapter — no more embedded datasource URL)
- **NextAuth v5 (Auth.js)** — Credentials provider (bcrypt) always on;
  Google provider wired but only activates if `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` are set
- **Tailwind CSS v4**, layered with hand-ported CSS custom properties and
  `.od-*` component classes copied from the screens file for pixel fidelity
- **cmdk** for the ⌘K command palette
- **Zod** for server-action input validation

## Architecture decisions worth knowing about

- **One workspace per user.** Matches the spec's solo-freelancer framing
  and the guided first-run flow (sign up → workspace setup → first client
  → first project). Multi-seat collaboration is explicitly out of scope.
- **QueryModal pattern instead of intercepting/parallel routes.** Record
  Payment, Transfer Ownership, Edit Client, etc. are modals driven by a URL
  search param (e.g. `?payment=1`) rather than Next's intercepting-route
  convention — simpler and lower-risk on a canary-track Next.js version,
  and it makes every modal state a shareable/bookmarkable URL for free.
- **`?view=by-client` and `?view=last-contact` are states of the list
  page, not separate routes** — matches the spec's explicit framing of
  those as view toggles.
- **One DB-level trigger** (`fn_projects_guard_completion`, in
  `prisma/migrations/20260822141500_completion_requires_transfer/`)
  blocks setting a project's stage to `completed` unless it was already
  `transferred`. Everything else (attention rules, derived totals) is
  computed in application code, not stored — this was the one rule the
  spec called out as "enforced by business logic, not just UI," so it's
  enforced at the database level too, not just in the server actions.
- **Client onboarding status is a user-set 3-way toggle**
  (`pending` / `onboarded` / `rejected`), never auto-derived — the spec is
  explicit that this must never be a dropdown or inferred.
- **Financial totals (paid, outstanding, booked) and attention flags are
  computed on read**, not stored, in `src/lib/data.ts` and
  `src/lib/attention.ts`. The four attention rules (built ≥14 days without
  transfer, no activity ≥14 days, onboarding pending, onboarding rejected)
  live in one place.
- **Timeline is append-only.** Editing a note writes a new `TimelineEvent`
  row rather than mutating history; project-level events (stage changes,
  payments) also mirror into the client's relationship log.

## Setup / running it

```bash
npx prisma dev --detach        # local Postgres-compatible dev DB, no Docker needed
npx prisma migrate deploy      # apply migrations, including the completion-guard trigger
npx prisma db seed             # seeds "Reed Interactive" workspace + sample data
npm run dev
```

`.env` needs `DATABASE_URL` (pointed at the `prisma dev` instance) and
`AUTH_SECRET`. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are optional —
leave blank to keep Google sign-in hidden.

Seeded login: **marcus@reedinteractive.com / orbitdesk123** at `/sign-in`,
with ~13 clients and ~16 projects spanning every stage, onboarding status,
and attention rule.

## Moved from D:\ to E:\

The project was originally created on a FAT32-formatted removable drive.
FAT32 can't support the symlinks/junctions Next.js/Turbopack and npm
require, which surfaced as install collisions, a Turbopack junction-point
failure, and a webpack `EISDIR` error that looked unrelated to each other
until traced to the filesystem. The project now lives at
`E:\Projects\Web_dev\Orbit desk\orbit_desk` (NTFS) — that's the copy the
dev server and this doc refer to; the original `D:\` copy is stale and can
be deleted.

## Verified end-to-end (Playwright smoke test)

Sign-in, overview (counts + attention list), projects list (tabs,
by-client view, search), project detail, recording a payment, marking
built/transferring a project, clients list and detail, archive
(rejected/archived tabs), a bogus URL correctly showing the 404 page with
live chrome and drawer counts, ⌘K search, sign-out, a brand-new sign-up
through workspace-setup → first client → first project → landing on
Overview, and a full mobile-viewport pass (header, account menu, bottom
tab bar). `npm run build` completes with zero TypeScript errors.

One real bug was found and fixed during this pass: the desktop top nav
used a hand-ported `.od-nav` class with its own unlayered `display: flex`,
which — per a Tailwind v4 cascade-layer rule — always overrode the
`hidden md:flex` utility classes meant to hide it on mobile, so the
desktop nav and the mobile header rendered stacked on top of each other.
Fixed with a dedicated `.od-nav-app` modifier class in
`src/app/globals.css` that implements the responsive toggle at the same
(unlayered) specificity. Sign-out was also missing entirely from the UI
until this pass — added `AccountMenu` (desktop, in the top nav; mobile, in
a new `MobileHeader`) and a `signOutAction` server action.

## Offline mode (IndexedDB)

A build-time flag (`NEXT_PUBLIC_OFFLINE_MODE=true` in `.env`) switches the
app to a client-side data layer backed by Dexie.js, for running/demoing
without a Postgres connection. Additive, not a rewrite: the Prisma/Postgres/
NextAuth path stays fully intact and is what runs with the flag off (the
default). Lives under `src/lib/offline/`.

- **Trivial local identity, not real auth.** A `User` table in Dexie
  (`id`, `name`, `surname`, `username`, `createdAt`) replaces Postgres's
  `User`/`Account`/`Session`/`VerificationToken`. Sign-up asks for Name,
  Surname, Username and creates the local user + their workspace
  (`Workspace.ownerId` → local user id, same one-workspace-per-user shape
  as online). Sign-in asks only for Username, looked up in Dexie — **no
  password field, no hashing, nothing checked**, deferred to v2. The
  current user id lives in `sessionStorage` (not IndexedDB), so signing in
  is required again each new browser session but survives reloads within
  one. The whole screen is `OfflineAuthScreen`, rendered by
  `WorkspaceProvider` in place of the app shell when nobody's signed in —
  there's no separate `/sign-in` route for it.
- **Route gating moved client-side.** `proxy.ts` and the root/sign-in/
  workspace-setup pages just check `isOfflineMode()` and get out of the
  way; `WorkspaceProvider` (wrapped around `AppShell`'s children) is what
  actually gates access, since edge middleware can't read
  `sessionStorage`/IndexedDB.
- **Every online route got an offline counterpart** (`Offline*Page.tsx`
  client components, e.g. `OfflineProjectDetailPage`), selected by a
  2-line guard prepended to each existing `page.tsx`
  (`if (isOfflineMode()) return <OfflineXPage />`) rather than rewriting
  the online version in place. Shared modal/form components
  (`ProjectForm`, `ClientForm`, `PaymentModal`, `LifecycleModals`,
  `CollaboratorModal`, `ProjectModals`, `ClientModals`, `AttentionRow`)
  gained an optional `action`/`archiveAction` prop defaulting to the
  online server action, so offline pages reuse the same UI instead of
  duplicating it — a `redirectTo` field on the shared `FormState` shape
  lets these components navigate after a client-side write resolves,
  since there's no server-side `redirect()` to throw here.
- **DB-enforced rules became explicit checks** in `src/lib/offline/writes/`:
  the completion-guard trigger (`markCompleted` only proceeds from
  `transferred`), the client-delete restriction (blocked while it has
  projects), since IndexedDB has no triggers or foreign keys.
- **Money stored as integer cents** (`fixedPriceCents`, `amountCents`), not
  `Decimal` — converted to a dollar `number` only at the `reads.ts`/
  `writes/` boundary, so every component sees the same shape it does online.
- **Reactive reads via `dexie-react-hooks`' `useLiveQuery`** in
  `src/lib/offline/reads.ts` — writes just mutate Dexie tables directly and
  the UI updates itself, no manual cache invalidation.
- **Demo data**: `src/lib/offline/seed.ts` mirrors `prisma/seed.ts` (same
  ~11 clients, ~14 projects across every stage) and runs automatically the
  first time a local profile is created — no manual seed step, since
  there's no terminal access from the browser.
- **`src/lib/attention.ts` and `src/lib/format.ts` were widened**
  (structural types instead of a `Prisma.ProjectGetPayload` import; date
  helpers accept `number` alongside `Date | string`) so the same attention
  rules and formatters serve both the Prisma-shaped and Dexie-shaped rows
  with no behavior change online.

Verified with a scripted Playwright pass against the actual dev server
with the flag flipped on: sign-up with no password screen → seeded
workspace on Overview → client detail → project detail → stage transition
(pending → active) → recording a payment (correct cents↔dollars
round-trip, outstanding recalculated) — zero console errors throughout.
Flag-off build and dev server were re-verified unaffected afterward.

## Multi-workspace support (offline mode only)

A single local offline profile can now own multiple workspaces and switch
between them, instead of needing a separate local profile per data bucket.
**Online/Postgres is untouched** — it keeps its strict one-workspace-per-user
model (`Workspace.ownerId @unique`); this was scoped to offline mode only.

- `UserRow` in `src/lib/offline/db.ts` gained `lastActiveWorkspaceId` — a
  plain (non-indexed) field, so no Dexie version bump was needed.
- `WorkspaceProvider` now live-queries *all* of a user's workspaces and
  derives "current" from `lastActiveWorkspaceId`, falling back to the
  oldest workspace if unset or stale. Context exposes `workspaces` (the
  full list) alongside the existing `workspace` (current). Switching or
  creating a workspace just updates that field in Dexie — every page's
  `useLiveQuery` hooks re-scope to the new `workspace.id` automatically,
  with zero changes needed anywhere in `reads.ts`/`writes/*.ts` (they
  already took `workspaceId` as a plain parameter).
- New `src/lib/offline/writes/workspace.ts` — `createWorkspace` (extra
  workspaces start **empty**, no `seedDemoData` call — only the first
  workspace created at sign-up gets the demo dataset) and `switchWorkspace`
  (just flips `lastActiveWorkspaceId`).
- The switcher lives inside the existing account-menu dropdown
  (`OfflineAccountMenu` in `AccountMenu.tsx`) — no new popover primitive.
  Lists each workspace (current one checkmarked), a "+ New workspace" link,
  then the existing Archive/Sign-out items. Switching navigates to
  `/overview` proactively, so you're never left on a detail page whose
  id belongs to the workspace you just switched away from.
- `NewWorkspaceModal` (new, `src/components/shell/`) — a minimal
  name-only form, following the same `QueryModal`/`ModalHeader` pattern as
  every other offline modal. Rendered once at the shell level (in
  `AppShell.tsx`, alongside `CommandPalette`) — **not** inside
  `AccountMenu` itself, since `AccountMenu` is mounted twice in the DOM
  (once in `TopNav` for desktop, once in `MobileHeader` for mobile, both
  always rendered and just CSS-hidden per viewport). Rendering the modal
  there first caused two overlapping modal instances fighting for clicks —
  caught by live Playwright testing, not by `tsc`/build, since both
  compiled cleanly despite the duplication.

Verified with a scripted Playwright pass: sign up → exactly one workspace
listed, marked current → create a second workspace → Overview/Clients
confirmed empty (no seeded data) → switch back to the first → seeded data
reappears → full page reload → switched-to workspace persists (stored in
IndexedDB, unlike the sessionStorage-scoped sign-in state) — zero console
errors throughout. `tsc --noEmit` and both flag-on/flag-off `next build`
runs clean.

## Sign-in page: password visibility toggle, Google button hidden

- **`PasswordInput`** (`src/components/auth/PasswordInput.tsx`) — a
  password `<input>` with a show/hide eye-icon button (plain inline SVGs,
  no new dependency) that toggles the field between `type="password"` and
  `type="text"`. Swapped into `SignInForm` and `SignUpForm` in place of the
  raw `<input type="password">`; `required`/`minLength`/`autoComplete`
  behavior is unchanged.
- **Google sign-in hidden, not removed.** `src/app/sign-in/page.tsx` gates
  both `<GoogleButton>` call sites behind a local
  `const SHOW_GOOGLE_SIGNIN = false;` — the component, its import, and its
  usage all stay in place, so re-enabling it later is a one-line flip back
  to `true`. Only affects the online `/sign-in` page; offline mode never
  had a Google option to begin with.

Verified with `tsc --noEmit` (clean); not re-verified in a live browser
this pass since the dev server wasn't reachable at the time.

## Known limitations / deferred

- **Money and Analytics** nav items are present but marked "Coming" per
  the spec — no implementation behind them (V2).
- **No real file storage** for client/workspace logos — `logoUrl` is a
  plain string field with no upload flow.
- **No automated test suite.** Verification was a manual Playwright smoke
  script (not part of the app's own dependencies) plus `npm run build`;
  there's no CI or unit/integration test harness.
- **Local dev database only** — `npx prisma dev` is a local
  Postgres-compatible instance, not a hosted database; production
  deployment would need a real Postgres connection string in
  `DATABASE_URL`.
