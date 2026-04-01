"use client";

import { useEffect, useState } from "react";

const PORTALS = [
  {
    id: "workday",
    label: "Workday",
    note: "Required on most large-company applications (Microsoft, Amazon, etc.)",
    icon: "🏢",
  },
  {
    id: "icims",
    label: "iCIMS",
    note: "Common at mid-size companies and universities",
    icon: "🏛️",
  },
  {
    id: "greenhouse",
    label: "Greenhouse",
    note: "Some companies lock their form behind a login",
    icon: "🌱",
  },
  {
    id: "lever",
    label: "Lever",
    note: "Rare, but occasionally requires an account",
    icon: "⚙️",
  },
  {
    id: "ashby",
    label: "Ashby",
    note: "Newer portal, some companies require login",
    icon: "✳️",
  },
  {
    id: "handshake",
    label: "Handshake",
    note: "Always requires login — university internship board",
    icon: "🤝",
  },
] as const;

type PortalId = (typeof PORTALS)[number]["id"];

interface PortalStatus {
  email: string;
  configured: boolean;
}

interface EditState {
  email: string;
  password: string;
  saving: boolean;
  error: string;
}

export function PortalAccountsCard() {
  const [accounts, setAccounts] = useState<Record<PortalId, PortalStatus> | null>(null);
  const [open, setOpen] = useState<PortalId | null>(null);
  const [edit, setEdit] = useState<EditState>({
    email: "",
    password: "",
    saving: false,
    error: "",
  });
  const [removing, setRemoving] = useState<PortalId | null>(null);

  useEffect(() => {
    fetch("/api/profile/portal-accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? null))
      .catch(() => {});
  }, []);

  function openEdit(portal: PortalId) {
    const current = accounts?.[portal];
    setEdit({
      email: current?.email ?? "",
      password: "",
      saving: false,
      error: "",
    });
    setOpen(portal);
  }

  async function handleSave(portal: PortalId) {
    if (!edit.email.trim() || !edit.password) {
      setEdit((e) => ({ ...e, error: "Email and password are both required" }));
      return;
    }
    setEdit((e) => ({ ...e, saving: true, error: "" }));
    const res = await fetch("/api/profile/portal-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal,
        email: edit.email.trim(),
        password: edit.password,
      }),
    });
    if (res.ok) {
      setAccounts((prev) => ({
        ...(prev ?? ({} as Record<PortalId, PortalStatus>)),
        [portal]: { email: edit.email.trim(), configured: true },
      }));
      setOpen(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setEdit((e) => ({
        ...e,
        saving: false,
        error: data?.error ?? "Save failed",
      }));
    }
  }

  async function handleRemove(portal: PortalId) {
    setRemoving(portal);
    const res = await fetch("/api/profile/portal-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal }),
    });
    if (res.ok) {
      setAccounts((prev) => ({
        ...(prev ?? ({} as Record<PortalId, PortalStatus>)),
        [portal]: { email: "", configured: false },
      }));
    }
    setRemoving(null);
  }

  const configuredCount = accounts
    ? PORTALS.filter((p) => accounts[p.id]?.configured).length
    : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Portal accounts</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Store your login credentials per portal so Twin can auto-login when it
            hits an authentication wall.{" "}
            {configuredCount > 0
              ? `${configuredCount} of ${PORTALS.length} portals configured.`
              : "None configured yet."}
          </p>
        </div>
        {configuredCount > 0 && (
          <span className="shrink-0 rounded-full bg-green-50 border border-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            {configuredCount} active
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {PORTALS.map((portal) => {
          const status = accounts?.[portal.id];
          const isOpen = open === portal.id;

          return (
            <div key={portal.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-base">{portal.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{portal.label}</p>
                    {status?.configured && (
                      <span className="rounded-full bg-green-50 border border-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        ✓ {status.email}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {portal.note}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {status?.configured && (
                    <button
                      onClick={() => handleRemove(portal.id)}
                      disabled={removing === portal.id}
                      className="text-[11px] text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {removing === portal.id ? "Removing…" : "Remove"}
                    </button>
                  )}
                  <button
                    onClick={() => (isOpen ? setOpen(null) : openEdit(portal.id))}
                    className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {isOpen ? "Cancel" : status?.configured ? "Update" : "Add"}
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {isOpen && (
                <div className="px-4 pb-4 bg-gray-50 space-y-3 border-t border-gray-100">
                  <div className="grid gap-2 sm:grid-cols-2 pt-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Email / username
                      </label>
                      <input
                        type="email"
                        value={edit.email}
                        onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={edit.password}
                        onChange={(e) => setEdit((s) => ({ ...s, password: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </div>
                  {edit.error && (
                    <p className="text-xs text-red-600">{edit.error}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">
                      Stored encrypted in your account. Never logged or shared.
                    </p>
                    <button
                      onClick={() => handleSave(portal.id)}
                      disabled={edit.saving}
                      className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {edit.saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        When your Twin hits a &quot;Sign In required&quot; wall, it uses these credentials to
        log in and resume filling the form automatically. Twin will never create
        new accounts on your behalf — only log in to existing ones.
      </p>
    </div>
  );
}
