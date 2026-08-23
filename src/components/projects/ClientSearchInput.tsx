"use client";

import { useState } from "react";
import { Command } from "cmdk";

/** A search-as-you-type replacement for a plain <select> — matches against
 * existing clients only (no inline-create). Submits the picked client's id
 * via a hidden input; the visible field is just the search/display text.
 *
 * Note: cmdk's `Command.Input` generates its own element id internally and
 * doesn't accept a custom one, so it can't be wired to an external
 * `<label htmlFor>` — the `label` prop below is cmdk's own (visually
 * hidden) accessible-label mechanism instead. */
export function ClientSearchInput({
  label,
  name = "clientId",
  clients,
  defaultClientId,
}: {
  label: string;
  name?: string;
  clients: Array<{ id: string; companyName: string }>;
  defaultClientId?: string;
}) {
  const defaultClient = clients.find((c) => c.id === defaultClientId);
  const [query, setQuery] = useState(defaultClient?.companyName ?? "");
  const [selectedId, setSelectedId] = useState(defaultClientId ?? "");
  const [open, setOpen] = useState(false);

  function select(client: { id: string; companyName: string }) {
    setSelectedId(client.id);
    setQuery(client.companyName);
    setOpen(false);
  }

  return (
    <Command shouldFilter loop label={label} style={{ position: "relative" }}>
      <input type="hidden" name={name} value={selectedId} />
      <Command.Input
        value={query}
        onValueChange={(v) => {
          setQuery(v);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Search clients…"
        autoComplete="off"
        className="od-input"
      />
      {open && (
        <Command.List
          className="absolute z-10 mt-1 flex flex-col"
          style={{
            width: "100%",
            maxHeight: 220,
            overflowY: "auto",
            background: "var(--od-surface)",
            border: "1px solid var(--od-rule-2)",
            boxShadow: "0 14px 40px rgba(0,0,0,.5)",
          }}
        >
          <Command.Empty className="od-muted text-[12.5px]" style={{ padding: "10px 12px" }}>
            No clients match.
          </Command.Empty>
          {clients.map((c) => (
            <Command.Item
              key={c.id}
              value={c.companyName}
              onMouseDown={(e) => e.preventDefault()}
              onSelect={() => select(c)}
              className="od-tab"
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              {c.companyName}
            </Command.Item>
          ))}
        </Command.List>
      )}
    </Command>
  );
}
