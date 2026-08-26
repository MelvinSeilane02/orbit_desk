import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/session";
import { getClientDetail } from "@/lib/data";
import { formatMoney, formatDateShort, formatRelative, formatContactName } from "@/lib/format";
import { onboardingTone, stageTone, StatusTag } from "@/components/ui/StatusTag";
import { EditClientModal } from "@/components/clients/ClientModals";
import { TruncatedTitle } from "@/components/ui/TruncatedTitle";
import { SubmitButton } from "@/components/loading/SubmitButton";
import { addClientNoteAction, rejectClientAction, restoreClientAction } from "@/lib/actions/clients";
import { isOfflineMode } from "@/lib/offline/mode";
import { OfflineClientDetailPage } from "./OfflineClientDetailPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  if (isOfflineMode()) return { title: "Client — Orbit Desk" };
  const { id } = await params;
  const workspace = await requireWorkspace();
  const detail = await getClientDetail(workspace.id, id);
  return { title: detail ? `${detail.client.companyName} — Orbit Desk` : "Client — Orbit Desk" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (isOfflineMode()) return <OfflineClientDetailPage />;

  const { id } = await params;
  const workspace = await requireWorkspace();
  const detail = await getClientDetail(workspace.id, id);
  if (!detail) notFound();

  const { client, projects, timeline, bookedTotal, outstandingTotal } = detail;
  const activeCount = projects.filter((p) =>
    ["pending", "active", "built", "transferred"].includes(p.stage)
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-[9px] px-[30px] py-3" style={{ borderBottom: "1px solid var(--od-rule)", background: "var(--od-surface)" }}>
        <Link href="/clients" style={{ fontSize: 11.5, color: "var(--od-brass)" }}>
          Clients
        </Link>
        <span style={{ fontSize: 11.5, color: "#5d544d" }}>/</span>
        <span style={{ fontSize: 11.5, fontWeight: 800 }}>{client.companyName}</span>
      </div>

      <div className="flex flex-none flex-wrap items-start justify-between gap-[18px] px-[30px] py-[22px]" style={{ borderBottom: "1px solid var(--od-rule-2)" }}>
        <div className="flex items-center gap-[14px]">
          <span style={{ width: 46, height: 46, flex: "none", background: "var(--od-oak)" }} />
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center gap-3">
              <h2>{client.companyName}</h2>
              <StatusTag tone={onboardingTone(client.onboardingStatus)} label={capitalize(client.onboardingStatus)} />
            </div>
            <span className="od-muted text-[13px]">
              Client since {formatDateShort(client.createdAt)} · {projects.length} project{projects.length === 1 ? "" : "s"} · {activeCount} active
            </span>
          </div>
        </div>
        <div className="flex flex-none gap-[9px]">
          <Link href={`/clients/${client.id}?edit=1`} className="od-btn od-btn-s">
            Edit client
          </Link>
          <Link href={`/projects?new=1&clientId=${client.id}`} className="od-btn od-btn-p">
            New project
          </Link>
          {client.onboardingStatus === "rejected" ? (
            <form action={restoreClientAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <SubmitButton className="od-btn od-btn-s">Restore client</SubmitButton>
            </form>
          ) : (
            <form action={rejectClientAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <SubmitButton className="od-btn od-btn-danger">Reject client</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-[22px] p-[22px] md:overflow-y-auto md:p-[26px]">
          <div className="flex flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <span className="od-plate">Projects · {projects.length}</span>
              <Link href={`/projects?new=1&clientId=${client.id}`} className="text-[12px] font-extrabold" style={{ color: "var(--od-brass)" }}>
                + New project
              </Link>
            </div>
            <div>
              {projects.length === 0 && (
                <p className="od-muted text-[13px]">No projects yet.</p>
              )}
              {projects.map((p) => {
                const { tone, label } = stageTone(p.stage);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="od-drawer" style={{ padding: "12px 15px" }}>
                    <span className="od-pull" />
                    <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <TruncatedTitle text={p.name} className="font-extrabold text-[13.5px]" />
                      <span className="od-muted overflow-hidden text-ellipsis whitespace-nowrap text-[11px]">{formatRelative(p.updatedAt)}</span>
                    </div>
                    <span style={{ width: 120 }}>
                      <StatusTag tone={tone} label={label} />
                    </span>
                    <span className="od-num text-right text-[13.5px]" style={{ width: 96 }}>
                      {formatMoney(p.fixedPrice.toString(), workspace.currency)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <span className="od-plate">Relationship log</span>
              <span className="od-muted text-[11.5px]">Notes and auto-logged events</span>
            </div>
            <form action={addClientNoteAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <textarea
                name="note"
                className="od-input od-input-dashed"
                placeholder="Add a note about this client"
              />
              <div className="mt-2 flex justify-end">
                <SubmitButton className="od-btn od-btn-s">Add note</SubmitButton>
              </div>
            </form>
            <div>
              {timeline.map((t) => (
                <div key={t.id} className="flex gap-[15px] py-[11px]" style={{ borderTop: "1px solid var(--od-rule)" }}>
                  <span style={{ flex: "none", width: 50, fontSize: 11, color: "#8d8278", paddingTop: 2 }}>
                    {formatDateShort(t.when).split(" ").slice(0, 2).join(" ")}
                  </span>
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[13px] leading-[1.5]">{t.what}</span>
                    <span style={{ fontSize: 10.5, color: "#6d635b" }}>{t.auto ? "Auto" : "You"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-none flex-col gap-[22px] p-[22px] md:w-[330px] md:p-6" style={{ borderTop: "1px solid var(--od-rule-2)", background: "var(--od-surface)" }}>
          <FactsBlock title="Contact">
            <FactRow label="Primary contact" value={formatContactName(client.primaryContactFirstName, client.primaryContactSurname) || "—"} emphasize />
            <FactRow label="Email" value={client.email || "—"} brass={Boolean(client.email)} />
            <FactRow label="Phone" value={client.phone || "—"} />
          </FactsBlock>

          <FactsBlock title="Summary">
            <div className="flex flex-col gap-[9px]">
              <MoneyRow label="Booked" value={formatMoney(bookedTotal, workspace.currency)} />
              <MoneyRow label="Outstanding" value={formatMoney(outstandingTotal, workspace.currency)} color="var(--od-yellow)" />
              <MoneyRow label="Last contact" value={formatRelative(client.updatedAt)} plain />
            </div>
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: "#6d635b" }}>
              Lifetime value and margin arrive with Analytics.
            </span>
          </FactsBlock>

          <FactsBlock title="Onboarding">
            <Checklist
              items={[
                { label: "Details captured", done: Boolean(client.email) },
                { label: "Terms agreed", done: client.onboardingStatus !== "pending" },
                { label: "First project created", done: projects.length > 0 },
              ]}
            />
          </FactsBlock>
        </div>
      </div>

      <EditClientModal
        client={{
          id: client.id,
          companyName: client.companyName,
          primaryContactFirstName: client.primaryContactFirstName,
          primaryContactSurname: client.primaryContactSurname,
          email: client.email,
          phone: client.phone,
          onboardingStatus: client.onboardingStatus,
          createdAt: client.createdAt,
        }}
      />
    </div>
  );
}

function FactsBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[11px]">
      <span className="od-plate">{title}</span>
      {children}
    </div>
  );
}

function FactRow({ label, value, emphasize = false, brass = false }: { label: string; value: string; emphasize?: boolean; brass?: boolean }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span style={{ fontSize: 10.5, color: "#8d8278" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: emphasize ? 800 : 400, color: brass ? "var(--od-brass)" : undefined }}>
        {value}
      </span>
    </div>
  );
}

function MoneyRow({ label, value, color, plain = false }: { label: string; value: string; color?: string; plain?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="od-muted text-[13px]">{label}</span>
      <span className={plain ? "text-[13px]" : "od-num text-[13.5px]"} style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Checklist({ items }: { items: Array<{ label: string; done: boolean }> }) {
  return (
    <div className="flex flex-col gap-[9px]">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-[10px]">
          <span
            style={{
              width: 14,
              height: 14,
              flex: "none",
              background: it.done ? "var(--od-green)" : "transparent",
              border: it.done ? "none" : "1px solid var(--od-rule-2)",
              color: "#12180d",
              fontSize: 8,
              fontWeight: 800,
              lineHeight: "14px",
              textAlign: "center",
            }}
          >
            {it.done ? "✓" : ""}
          </span>
          <span className="text-[12.5px]">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
