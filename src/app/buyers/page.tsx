"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Globe, Mail, Key, Users, ShoppingBag,
  Pencil, Loader2, CheckCircle, Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatUSD, PRODUCTS, INCOTERMS, cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import type { Buyer } from "@/lib/supabase";

// ── Buyer modal ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  company: "", contact_name: "", email: "", phone: "", country: "",
  address: "", preferred_product: [] as string[], preferred_incoterm: "", payment_terms: "",
};

function BuyerModal({ buyer, onClose, onSaved }: {
  buyer: Buyer | null;
  onClose: () => void;
  onSaved: (b: Buyer) => void;
}) {
  const supabase = createClient();
  const [form, setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  useEffect(() => {
    setForm(buyer ? {
      company:            buyer.company,
      contact_name:       buyer.contact_name,
      email:              buyer.email,
      phone:              buyer.phone ?? "",
      country:            buyer.country,
      address:            buyer.address ?? "",
      preferred_product:  (buyer.preferred_product ?? "").split(", ").filter(Boolean),
      preferred_incoterm: buyer.preferred_incoterm ?? "",
      payment_terms:      buyer.payment_terms ?? "",
    } : { ...EMPTY_FORM });
    setErr(null);
  }, [buyer]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim())  { setErr("Company is required."); return; }
    if (!form.email.trim())    { setErr("Email is required."); return; }
    if (!form.country.trim())  { setErr("Country is required."); return; }
    setSaving(true); setErr(null);

    const payload = {
      company:            form.company,
      contact_name:       form.contact_name,
      email:              form.email,
      phone:              form.phone || null,
      country:            form.country,
      address:            form.address || null,
      preferred_product:  form.preferred_product.length ? form.preferred_product.join(", ") : null,
      preferred_incoterm: form.preferred_incoterm || null,
      payment_terms:      form.payment_terms || null,
    };

    try {
      if (buyer) {
        const { data, error } = await supabase.from("buyers").update(payload)
          .eq("id", buyer.id).select().single();
        if (error) throw error;
        onSaved(data as Buyer);
      } else {
        const { data, error } = await supabase.from("buyers").insert(payload)
          .select().single();
        if (error) throw error;
        onSaved(data as Buyer);
      }
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {buyer ? `Edit — ${buyer.company}` : "Add Buyer"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company *</label>
              <input className="input" placeholder="Acme Health GmbH" value={form.company} onChange={e => set("company", e.target.value)} required />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" placeholder="Maria Schmidt" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" placeholder="maria@acme.de" value={form.email} onChange={e => set("email", e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+49 30 000 0000" value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">Country *</label>
              <CountrySelect
                value={form.country}
                onChange={v => set("country", v)}
                placeholder="Select country…"
                required
              />
            </div>
            <div>
              <label className="label">Preferred Products</label>
              <MultiSelect
                options={PRODUCTS}
                value={form.preferred_product}
                onChange={v => setForm(f => ({ ...f, preferred_product: v }))}
                placeholder="Select products…"
              />
            </div>
            <div>
              <label className="label">Preferred Incoterm</label>
              <select className="input" value={form.preferred_incoterm} onChange={e => set("preferred_incoterm", e.target.value)}>
                <option value="">Select incoterm…</option>
                {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Payment Terms</label>
              <input className="input" placeholder="e.g. 30% advance, 70% against BL" value={form.payment_terms} onChange={e => set("payment_terms", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <textarea className="input min-h-[72px] resize-y" placeholder="Full address…" value={form.address} onChange={e => set("address", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : buyer ? "Save Changes" : "Add Buyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Buyer card ─────────────────────────────────────────────────────────────────
function BuyerCard({ buyer, onEdit, onInvite, inviting }: {
  buyer: Buyer;
  onEdit: (b: Buyer) => void;
  onInvite: (b: Buyer) => void;
  inviting: boolean;
}) {
  return (
    <div className="card flex flex-col p-5 gap-4">
      {/* Top row: company + edit */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{buyer.company}</h3>
          {buyer.contact_name && (
            <p className="text-sm text-gray-500 truncate">{buyer.contact_name}</p>
          )}
        </div>
        <button
          onClick={() => onEdit(buyer)}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Edit buyer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contact info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Globe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{buyer.country}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{buyer.email}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
            <ShoppingBag className="h-3 w-3" /> Orders
          </div>
          <p className="text-sm font-semibold text-gray-900">{buyer.total_orders}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
            <Users className="h-3 w-3" /> Value
          </div>
          <p className="text-sm font-semibold text-gray-900">{formatUSD(buyer.total_value_usd)}</p>
        </div>
      </div>

      {/* Portal status + invite */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        {buyer.portal_access ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" /> Portal active
          </span>
        ) : (
          <span className="text-xs text-gray-400">No portal access</span>
        )}

        <button
          onClick={() => onInvite(buyer)}
          disabled={inviting}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            buyer.portal_access
              ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
              : "bg-emerald-700 text-white hover:bg-emerald-800"
          )}
        >
          {inviting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Key className="h-3.5 w-3.5" />
          }
          {buyer.portal_access ? "Re-invite" : "Invite to portal"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function BuyersPage() {
  const supabase = createClient();

  const [buyers,   setBuyers]   = useState<Buyer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,  setEditing]  = useState<Buyer | null>(null);
  const [inviting, setInviting] = useState<string | null>(null); // buyer id being invited
  const [toast,    setToast]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase
      .from("buyers").select("*").order("created_at", { ascending: false });
    if (err) { setError(err.message); } else { setBuyers((data ?? []) as Buyer[]); }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = search
    ? buyers.filter(b =>
        b.company.toLowerCase().includes(search.toLowerCase()) ||
        b.email.toLowerCase().includes(search.toLowerCase()) ||
        b.country.toLowerCase().includes(search.toLowerCase())
      )
    : buyers;

  const portalCount = buyers.filter(b => b.portal_access).length;

  async function invitePortalAccess(buyer: Buyer) {
    setInviting(buyer.id);
    try {
      const res  = await fetch("/api/buyers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: buyer.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }

      // Update portal_access in local state
      setBuyers(prev => prev.map(b =>
        b.id === buyer.id ? { ...b, portal_access: true } : b
      ));
      setToast(`✓ Portal invite sent to ${data.email}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(null);
    }
  }

  function handleSaved(saved: Buyer) {
    setBuyers(prev => {
      const idx = prev.findIndex(b => b.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  }

  return (
    <div className="p-8 space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <CheckCircle className="h-4 w-4" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buyers</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : (
              <>{buyers.length} buyer{buyers.length !== 1 ? "s" : ""} · <span className="text-emerald-700 font-medium">{portalCount} with portal access</span></>
            )}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Buyer
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <Info className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
        <p className="text-sm text-emerald-800">
          <strong>Buyer Portal:</strong> Each buyer can receive a secure login link to view their orders,
          invoices, shipment tracking, and shared documents — without seeing your internal data.
          Click <strong>&ldquo;Invite to portal&rdquo;</strong> to send them a magic link via email.
        </p>
      </div>

      {/* Search */}
      <input
        className="input max-w-sm"
        placeholder="Search by company, email, or country…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && (
        <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-56 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">
            {buyers.length === 0
              ? <><button className="text-emerald-700 hover:underline font-medium" onClick={() => { setEditing(null); setModalOpen(true); }}>Add your first buyer →</button></>
              : "No buyers match your search."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(buyer => (
            <BuyerCard
              key={buyer.id}
              buyer={buyer}
              onEdit={b => { setEditing(b); setModalOpen(true); }}
              onInvite={invitePortalAccess}
              inviting={inviting === buyer.id}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <BuyerModal
          buyer={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
