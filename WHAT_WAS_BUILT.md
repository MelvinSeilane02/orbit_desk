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
- **Two DB-level triggers.** `fn_projects_guard_completion` (in
  `prisma/migrations/20260822141500_completion_requires_transfer/`) blocks
  setting a project's stage to `completed` unless it was already
  `transferred`. `fn_clients_set_onboarding` (added later — see "Client
  onboarding" below) auto-derives a client's onboarding status. Everything
  else (attention rules, derived totals) is computed in application code,
  not stored.
- **Client onboarding status is auto-derived, not a manual toggle** —
  see the dedicated section below. (Superseded: it originally shipped as a
  user-set 3-way toggle per the Master Build Spec; that decision was later
  deliberately overridden.)
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
npx prisma migrate deploy      # apply migrations, including the completion-guard and onboarding triggers
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

## Client onboarding: auto-derived, not a manual toggle (both modes)

Client onboarding status was originally a manual 3-way toggle
(`pending`/`onboarded`/`rejected`), per the Master Build Spec ("a
three-way segmented control, never a dropdown"). It's now **auto-derived**
from contact completeness, per section 7a of `orbit-desk-master-build-prompt.md`
— a deliberate, later override of that original decision, not a bug fix.

Both source spec documents were verified directly before making this
change (they live outside this repo). They genuinely disagreed: the Master
Build Spec called for a manual toggle; §7a called for an auto-derived
`onboardingComplete` boolean, recalculated on every write, with `rejected`
exempt. The original build correctly followed this project's own
documented tie-break rule ("Master Build Spec wins on field names") — this
was a knowing, later decision to override that precedent for this one
field specifically, made after confirming both documents said what each
side of the request claimed.

- **`Client.primaryContact` (one string) split into
  `primaryContactFirstName`/`primaryContactSurname`** — matches §7a's
  field-level wording. A client is "complete" once first name, surname,
  and email are all present and non-blank.
- **Online: `fn_clients_set_onboarding` trigger** (new migrations —
  `prisma/migrations/20260823000000_client_onboarding_fields/` and
  `.../20260823000001_client_onboarding_trigger/`, hand-written like the
  existing completion-guard trigger since this project's local `prisma dev`
  instance connects directly to `template1`, which breaks `prisma migrate
  dev`'s shadow-database mechanism — every new shadow DB inherits
  `template1`'s existing objects, causing false "already exists" errors;
  worked around by hand-writing migrations and applying with `migrate
  deploy`, which needs no shadow DB). `BEFORE INSERT OR UPDATE`, recomputes
  `onboardingComplete` and — unless the row's current status is
  `rejected` — `onboardingStatus`, every time.
- **Offline: `computeOnboardingComplete()`** in
  `src/lib/offline/writes/clients.ts` — the explicit reimplementation,
  same pattern as `markCompleted()` reimplementing the completion-guard.
  Also used by `src/lib/offline/seed.ts` so the offline demo data stays
  self-consistent rather than trusting hardcoded status values.
- **Rejection stays an explicit user action.** New `rejectClientAction`/
  `restoreClientAction` (and offline equivalents) — plain one-click
  buttons on the client detail page, no reason field (unlike project
  rejection). The trigger/helper only ever auto-toggles pending↔onboarded;
  a rejected client is never resurrected by editing it.
- **`ClientForm`'s onboarding toggle removed**, replaced with a read-only
  `StatusTag` badge showing whatever the DB/Dexie actually computed.
- **Seed data**: three demo clients needed real data fixes, not just the
  field split, since the trigger is unconditional on every insert —
  Northgate Legal and Cobalt Fitness now have their surname genuinely
  omitted (a believable "mid-onboarding" state) so they still land on
  `pending`; Aldgate Prints had no email at all in the original seed (a
  latent bug this migration exposed — it would've been forced to `pending`
  despite having a completed, archived project attached), fixed by adding
  one.

Verified with a scripted Playwright pass in **both** modes: all three
required cases — filling in a missing field flips pending→onboarded with
a logged timeline event; clearing a field flips an onboarded client back
to pending; rejecting a fully-complete client and re-saving it keeps it
rejected (confirms the guard), then restoring it immediately recomputes to
onboarded — all passed with zero console errors. Also caught and fixed: a
stale dev-server Node module cache serving the pre-migration Prisma Client
shape after `prisma generate` (a `PrismaClientKnownRequestError` for the
dropped `primaryContact` column) — resolved with a dev server restart, not
a code change.

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

## Loading animation system — Phase 1 (Oak Grain Sweep + Document Stack Alignment)

Replaces "please wait" loading UI with the drawer/filing-cabinet motion
language from a dedicated build prompt (five animations total; this pass
ships the first two, per that prompt's own build order). No spinners,
no progress bars — a thin oak-grain sweep for small async ops and page
transitions, offset document cards settling into a stack for
project/client data loading.

- **Foundation** (`src/app/globals.css`): three new tokens on `:root`
  (`--od-dur`, `--od-dur-fast`, `--od-ease`), a new unlayered
  `.od-loading-*` section with `@keyframes` for grain drift, a travelling
  highlight sweep, and card settling (rotation clamped to 1–2deg), and
  the first `prefers-reduced-motion` handling anywhere in the app — every
  new animation collapses to a plain opacity fade under it, no
  translate/rotate. Stays unlayered like the rest of the file (see the
  `.od-nav-app` cascade-layer note above); confirmed via computed-style
  inspection in a live browser, not just a successful build, per that
  same lesson.
- **`src/lib/loading/useDelayedPending.ts`**: the show-delay/min-duration
  hook every loader is driven through — a pending state has to hold for
  ~180ms before anything renders, and once shown it stays at least
  ~400ms even if the data resolves early. This is what makes the
  animations safe to wire into offline mode's near-instant Dexie reads
  without ever flashing.
- **`src/components/loading/`**: `OakGrainSweep` (`variant="block"` for a
  content container, `"inline"` for inside a button),
  `DocumentStackAlignment`, and `SubmitButton` — a drop-in replacement
  for a bare `<button type="submit">` that uses `useFormStatus` +
  `useDelayedPending` to swap its label for the inline sweep while
  pending. Works identically for online server actions and offline
  write functions bound via `action={(fd) => fn(...)}`.
- **Wired into the real gaps**, all previously silent: the add-note,
  remove-collaborator, start-work/mark-completed/archive, and
  reject/restore buttons on both project and client detail pages (online
  and offline), `CollaboratorModal`, the workspace-setup "Skip for now"
  button, and the online sign-out button — all now `SubmitButton`. The
  offline `AccountMenu` workspace switch (a plain `onClick`, not a form)
  now runs through `useTransition` with the same inline sweep.
- **New `loading.tsx` route boundaries**: `DocumentStackAlignment` for
  `/projects/[id]` and `/clients/[id]`, `OakGrainSweep` for `/projects`,
  `/clients`, and `/archive` — render inside `AppShell`'s content area,
  so nav chrome stays put during the transition. The offline detail
  pages' `if (detail === undefined) return null` blank-screen window
  (visible after creating a project/client or switching workspace) now
  shows `DocumentStackAlignment` through the same delayed-pending gate
  instead.
- **Deliberately not touched this pass**: Filing Cabinet Organisation,
  Wooden Drawer Reveal, Drawer Index Tabs, `WorkspaceProvider`'s
  first-load blank screens, `/overview`, and the ⌘K command palette's
  loading state — all explicitly deferred by the source build prompt's
  own build order and open questions.

Caught one real bug during verification: a code comment mentioning
`animate-*/transition-*` contained a literal `*/`, prematurely closing
the CSS comment and corrupting the rules that followed — Lightning CSS
flagged it as a build warning ("Unexpected token Delim('*')"), fixed by
rewording the comment. Verified with `tsc --noEmit` (clean), `next build`
in both `NEXT_PUBLIC_OFFLINE_MODE` states (clean), and a live Playwright
pass in offline mode: zero console errors across sign-up, navigation,
note submission, reject/restore, and the account-menu workspace switch;
computed-style checks confirmed the new keyframes actually apply (not
silently overridden) and that `prefers-reduced-motion` correctly
collapses every animation to an opacity-only fade.

## Offline backup & restore — Phase 1 (Export + Full Replace)

Workspace-scoped backup/restore for offline mode, from a spec that
required a pre-implementation audit against the real Dexie schema (it had
been reconstructed from this document, not the code). The audit corrected
several of the spec's assumptions: there is no `projectClients` junction
table (client↔project is one-to-many via `ProjectRow.clientId`), the
`collaborators` table wasn't accounted for in the spec's scope at all
despite holding real per-project data, and client onboarding was already
the auto-derived version (built earlier this session) rather than the
manual-toggle bug the spec worried about. Full spec covers Export, Full
Replace, Merge (tiered conflict resolution), and Checkpoint restore; this
pass ships **Export + Full Replace only** — the user's explicit choice,
given the size of the full spec — with Merge and Checkpoint deferred.

- **`src/lib/offline/backup/types.ts`**: Zod schemas for the backup file
  shape, mirroring `db.ts`'s row types independently (so a backup file's
  shape is validated on its own terms, not just cast to whatever the live
  schema currently looks like).
- **`src/lib/offline/backup/export.ts`**: `exportWorkspaceBackup()` scopes
  `clients`/`projects`/`timelineEvents` by `workspaceId` directly, and
  `collaborators`/`payments` (which carry no `workspaceId` of their own)
  by joining through the workspace's project ids — same pattern
  `reads.ts`'s `paidTotalsByProject` already uses. Money stays raw integer
  cents. Workspace metadata exported is `{ name, currency, timezone,
  logoUrl }` only — no `id`/`ownerId`, so a restored/imported backup can
  never carry local-identity information across devices.
- **`src/lib/offline/backup/restore.ts`**: `parseBackupFile()` does
  schema-version/shape validation (Zod) then an internal referential
  check (every `clientId`/`projectId` a record points at must exist
  within the backup's own data) and rejects the whole file on any
  failure. `restoreWorkspaceBackup()` runs Full Replace inside one Dexie
  transaction: the target workspace's *metadata* is updated in place
  (never deleted — it's the container being restored into, not a scoped
  table), its current clients/projects/collaborators/payments/
  timelineEvents are deleted, then the backup's records are bulk-put back
  with only `workspaceId` rewritten. Ids are kept exactly as they appear
  in the backup (`crypto.randomUUID()` makes cross-device collisions
  practically impossible), so referential integrity between
  clients/projects/collaborators/payments carries over automatically with
  no separate id-remapping pass. Every restored client's
  `onboardingComplete`/`onboardingStatus` is recomputed via the existing
  `computeOnboardingComplete()` (from `writes/clients.ts`) as the final
  step — never taken verbatim from the file, `rejected` still exempted
  (the helper already handles that internally).
- **`src/lib/offline/backup/file.ts`**: File System Access API
  (`showSaveFilePicker`/`showOpenFilePicker`) with a Blob +
  `<a download>` / `<input type=file>` fallback for browsers that don't
  support it (Firefox/Safari, and this is also the path automated
  verification exercises — headless Chromium auto-resolves the picker
  APIs to an unobservable location). No persistent folder-handle caching
  yet — every backup/restore re-prompts.
- **`src/components/backup/RestoreModal.tsx`**: `QueryModal`-based,
  matching `CollaboratorModal`'s existing shape. Pick → preview (record
  counts, export date, an explicit red warning that this replaces
  everything) → confirm → progress (reusing `OakGrainSweep` from the
  loading-animation system, not a spinner) → done flow. Entry point is a
  "Restore workspace" link in `AccountMenu.tsx`'s offline dropdown, next
  to the workspace switcher — there's no settings page anywhere in the
  app, so this was the only sensible existing surface.
- **Backup, revised**: there is no standalone "Backup workspace" menu
  entry anymore — it was folded into sign-out instead, on the reasoning
  that the moment backing up actually matters is the moment the data is
  about to become unreachable (sign-out drops back to the sign-in
  screen), not some separate, easy-to-forget menu action. Clicking
  "Sign out" in `AccountMenu.tsx`'s offline dropdown now opens
  **`src/components/backup/SignOutConfirmModal.tsx`**, which offers two
  explicit choices — "Sign out" (immediate) or "Backup and sign out"
  (runs the same `exportWorkspaceBackup`/`downloadBackupFile` export,
  shows the inline `OakGrainSweep` loading animation on that button and
  disables both buttons while it runs, then calls `signOut()`
  automatically once the download completes). Closing the overlay (✕,
  backdrop, Escape) cancels either path — nothing happens. The offline
  sign-in/sign-up screen (`OfflineAuthScreen.tsx`) also now carries a
  brief reminder to back up regularly, on both the returning-user and
  new-profile sides.

**Deliberately not built this pass**: Merge mode's tiered conflict
resolution, Checkpoint restore and its `backupCheckpoints` cursor table,
and persistent folder-handle caching. Online/Postgres mode is untouched,
matching the multi-workspace feature's precedent — its sign-out stays a
plain immediate action, since "backup" isn't a concept that applies to
Postgres-backed data.

Verified with `tsc --noEmit` (clean), `next build` in both
`NEXT_PUBLIC_OFFLINE_MODE` states (clean — one online-mode build as
regression insurance even though no online files changed), and two live
Playwright passes: (1) the original export/restore round-trip — sign up →
backup a seeded demo workspace (12 clients, 15 projects, 11 payments, 50
timeline events) → create a second, empty workspace → restore the backup
into it → confirm all 12 clients land correctly with onboarding
recomputed; (2) the reworked sign-out flow — confirm both auth-screen
tips render, the dropdown no longer shows a standalone backup link, the
sign-out overlay opens with the right copy, "Backup and sign out"
produces the same correct export and lands back on the sign-in screen
once it's done, plain "Sign out" signs out immediately with no backup,
and Escape cancels the overlay with the user still signed in. Zero
console errors throughout both passes.

## List-row title truncation (`TruncatedTitle`)

Project/client names in list rows (both online and offline `/projects` and
`/clients`) could overflow or wrap awkwardly on mobile, where secondary
columns get hidden and the title has to share a flex row with a status tag
and a price. `src/components/ui/TruncatedTitle.tsx` truncates with an
ellipsis via CSS, uses the native `title` attribute for hover-to-reveal on
desktop, and — since touch devices have no hover — measures
`scrollWidth > clientWidth` on mount/resize to conditionally show a small
"i" button that opens a `createPortal`-rendered popover with the full text
on tap. New `.od-truncate`/`.od-title-hint-*` rules in `globals.css`.
Swapped in for the plain title spans in both projects list views
(`ListView`, `ByClientView`) and the clients list, online and offline.

## Multi-currency projects + `Money` value object (offline mode)

Each project can now be priced in a currency other than its workspace's
default, with a hand-entered conversion rate — the offline-mode
counterpart to the `Money`/`Analytics` "Coming" nav items eventually
needing real currency handling. **Online/Postgres is untouched**: `Project`
has no currency column there yet, matching this doc's existing precedent of
scoping speculative-shaped features to offline mode first (see
multi-workspace support above).

- **`src/lib/money.ts`**: a `Money` class (amount in integer cents + an ISO
  currency code, bundled so the two can't drift apart or get passed to the
  wrong `formatMoney(amount, currency)` slot) with `add`/`subtract`
  (currency-checked, throws on mismatch), `convert(rate, toCurrency)`, and
  `format()`. Replaces the old free-floating
  `dollarsToCents`/`centsToDollars` pair (`src/lib/offline/money.ts`,
  deleted) everywhere in the offline data layer — `reads.ts`,
  `writes/projects.ts`, `writes/payments`, and `seed.ts` now pass `Money`
  objects instead of raw numbers.
- **`src/lib/currencies.ts`**: the `CURRENCIES` list (USD/GBP/EUR/CAD/AUD,
  plus new ZAR) hoisted out of `WorkspaceSetupForm` so the same list also
  drives the new per-project currency picker and the account-menu default-
  currency selector.
- **`ProjectRow` gained optional `currency`/`conversionRate`** fields
  (`src/lib/offline/db.ts`) — optional so rows written before this shipped
  keep working, falling back to the workspace's currency (rate 1) via
  `projectCurrency()`/`projectConversionRate()` helpers in `reads.ts`.
  `resolveProjectCurrency()` in `writes/projects.ts` handles both create and
  update: picking the workspace default needs no rate, picking anything
  else requires a rate > 0 or the write is rejected. The rate is a
  manually-entered number (1 unit of the project's currency = `rate` units
  of the workspace default), not a live FX lookup — same manual-entry
  pattern as `Client`'s existing fields, and avoids adding an external API
  dependency for a V1 feature.
- **`reads.ts` reworked to return `Money` everywhere** money used to be a
  plain `number`: `ProjectListRow.fixedPrice/paidTotal/outstanding`,
  `ProjectDetail.paidTotal/outstanding` (plus a new
  `outstandingInDefaultCurrency`, populated only when the project's
  currency differs from the workspace's), and both clients' list/detail
  `bookedTotal/outstandingTotal`. Payments are recorded in the project's
  own currency, so per-project totals stay in that currency; any total that
  combines *multiple* projects (by-client grouping, client list/detail)
  converts each project through its own `conversionRate` into the
  workspace default before summing, via the new `fixedPriceInDefaultCurrency()`
  helper and `sumMoney()`.
- **UI**: `ProjectForm`/`ProjectModals` gained a currency `<select>` and,
  once a non-default currency is chosen, a required conversion-rate input
  — gated behind a new optional `workspaceCurrency` prop so the online
  forms (which don't pass it, since Postgres has no per-project currency
  yet) render unchanged. The project detail page's Pricing block shows
  `Pricing · EUR` in the heading when the project's currency differs from
  the workspace default, with an "≈ $X at your rate" line under
  Outstanding. `AccountMenu`'s offline dropdown gained a "Default currency"
  selector (`updateWorkspaceCurrency()` in `writes/workspace.ts`) — changing
  it only affects new projects' default and multi-project total
  conversions; existing projects keep the currency/rate they were given.

`npx tsc --noEmit` is clean on this change. Not yet verified with a live
Playwright pass — the change is still staged/uncommitted as of this
update.

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
