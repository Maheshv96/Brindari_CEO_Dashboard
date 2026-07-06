"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Star, AlertTriangle, Brain, Pencil,
  MapPin, Clock, Package, Loader2, RefreshCw, Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatINR, PRODUCTS, cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Tip, TIPS } from "@/components/ui/Tip";
import type { Supplier, SupplierQuote } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type QuoteWithSupplier = SupplierQuote & { suppliers: { company: string } | null };

const CERT_OPTIONS = ["FSSAI", "Organic", "ISO 22000", "HACCP", "Kosher", "Halal"];

const EMPTY_SUPPLIER = {
  company: "", contact_name: "", email: "", location: "",
  products: [] as string[],
  price_per_kg_inr: "", moq_kg: "", lead_time_days: "", payment_terms: "",
  rating: "5", certifications: [] as string[], notes: "",
};

// ── Star rating display ────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number | null }) {
  const r = Math.round(rating ?? 0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= r ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
      ))}
    </div>
  );
}

// ── Add/Edit Supplier modal ────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose, onSaved }: {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: (s: Supplier) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({ ...EMPTY_SUPPLIER });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) {
      setForm({
        company:         supplier.company,
        contact_name:    supplier.contact_name,
        email:           supplier.email ?? "",
        location:        supplier.location ?? "",
        products:        (supplier.product ?? "Moringa Powder").split(", ").filter(Boolean),
        price_per_kg_inr: String(supplier.price_per_kg_inr ?? ""),
        moq_kg:          String(supplier.moq_kg ?? ""),
        lead_time_days:  String(supplier.lead_time_days ?? ""),
        payment_terms:   supplier.payment_terms ?? "",
        rating:          String(supplier.rating ?? 5),
        certifications:  supplier.certifications ?? [],
        notes:           "",
      });
    } else {
      setForm({ ...EMPTY_SUPPLIER });
    }
    setErr(null);
  }, [supplier]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function toggleCert(c: string) {
    setForm(f => ({
      ...f,
      certifications: f.certifications.includes(c)
        ? f.certifications.filter(x => x !== c)
        : [...f.certifications, c],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) { setErr("Company is required."); return; }
    setSaving(true); setErr(null);

    const payload = {
      company:          form.company,
      contact_name:     form.contact_name,
      email:            form.email || null,
      location:         form.location || null,
      product:          form.products.length ? form.products.join(", ") : "Moringa Powder",
      price_per_kg_inr: form.price_per_kg_inr ? Number(form.price_per_kg_inr) : null,
      moq_kg:           form.moq_kg ? Number(form.moq_kg) : null,
      lead_time_days:   form.lead_time_days ? Number(form.lead_time_days) : null,
      payment_terms:    form.payment_terms || null,
      rating:           form.rating ? Number(form.rating) : null,
      certifications:   form.certifications.length ? form.certifications : null,
      is_active:        true,
    };

    try {
      const q = supplier
        ? supabase.from("suppliers").update(payload).eq("id", supplier.id).select().single()
        : supabase.from("suppliers").insert(payload).select().single();
      const { data, error } = await q;
      if (error) throw error;
      onSaved(data as Supplier);
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
          <h2 className="text-base font-semibold text-gray-900">{supplier ? "Edit Supplier" : "Add Supplier"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company *</label>
              <input className="input" placeholder="Green Valley Farms" value={form.company} onChange={e => set("company", e.target.value)} required />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" placeholder="Ravi Kumar" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="ravi@farm.com" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" placeholder="Coimbatore, Tamil Nadu" value={form.location} onChange={e => set("location", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Products Supplied</label>
              <MultiSelect
                options={PRODUCTS}
                value={form.products}
                onChange={v => setForm(f => ({ ...f, products: v }))}
                placeholder="Select products this supplier can supply…"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">Price / kg (INR) <Tip content="Ex-Works price per kilogram in Indian Rupees. This is the base cost before transport and export charges." /></label>
              <input className="input" type="number" min="0" step="0.01" placeholder="280" value={form.price_per_kg_inr} onChange={e => set("price_per_kg_inr", e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">MOQ (kg) <Tip content={TIPS.MOQ} /></label>
              <input className="input" type="number" min="0" placeholder="500" value={form.moq_kg} onChange={e => set("moq_kg", e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">Lead Time (days) <Tip content="Number of days from order placement to goods ready for dispatch. Includes production and packing time." /></label>
              <input className="input" type="number" min="0" placeholder="7" value={form.lead_time_days} onChange={e => set("lead_time_days", e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">Payment Terms <Tip content={TIPS.PaymentTerms} /></label>
              <input className="input" placeholder="50% advance, 50% on delivery" value={form.payment_terms} onChange={e => set("payment_terms", e.target.value)} />
            </div>
            <div>
              <label className="label">Rating (1–5)</label>
              <select className="input" value={form.rating} onChange={e => set("rating", e.target.value)}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? "s" : ""}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">Certifications <Tip content={TIPS.FSSAI} wide /></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CERT_OPTIONS.map(c => (
                <button key={c} type="button"
                  onClick={() => toggleCert(c)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    form.certifications.includes(c)
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-500"
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : supplier ? "Save Changes" : "Add Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Quote modal ────────────────────────────────────────────────────────────
function QuoteModal({ suppliers, onClose, onSaved }: {
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: (q: QuoteWithSupplier) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({ supplier_id: "", price_per_kg_inr: "", quantity_kg: "", valid_until: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplier_id)      { setErr("Select a supplier."); return; }
    if (!form.price_per_kg_inr) { setErr("Price is required."); return; }
    setSaving(true); setErr(null);

    const payload = {
      supplier_id:      form.supplier_id,
      product:          suppliers.find(s => s.id === form.supplier_id)?.product?.split(", ")[0] ?? "Moringa Powder",
      price_per_kg_inr: Number(form.price_per_kg_inr),
      quantity_kg:      form.quantity_kg ? Number(form.quantity_kg) : 0,
      valid_until:      form.valid_until || null,
      quote_date:       new Date().toISOString().slice(0, 10),
    };

    try {
      const { data, error } = await supabase.from("supplier_quotes").insert(payload).select().single();
      if (error) throw error;
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      onSaved({ ...data, suppliers: supplier ? { company: supplier.company } : null } as QuoteWithSupplier);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Add Quote</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}
          <div>
            <label className="label">Supplier *</label>
            <select className="input" value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)} required>
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price / kg (INR) *</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="280" value={form.price_per_kg_inr} onChange={e => set("price_per_kg_inr", e.target.value)} required />
            </div>
            <div>
              <label className="label">Quantity (kg)</label>
              <input className="input" type="number" min="0" placeholder="500" value={form.quantity_kg} onChange={e => set("quantity_kg", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Valid Until</label>
            <input className="input" type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add Quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Supplier card ──────────────────────────────────────────────────────────────
function SupplierCard({ supplier, quotes, onEdit, onAddQuote, selected, onToggleSelect }: {
  supplier: Supplier;
  quotes: SupplierQuote[];
  onEdit: (s: Supplier) => void;
  onAddQuote: (s: Supplier) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const sorted    = [...quotes].sort((a, b) => new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime());
  const latestQ   = sorted[0];
  const displayPrice = latestQ?.price_per_kg_inr ?? supplier.price_per_kg_inr;

  return (
    <div className={cn("card flex flex-col gap-4 p-5 transition-all", selected && "ring-2 ring-emerald-500")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={selected} onChange={() => onToggleSelect(supplier.id)}
              className="h-3.5 w-3.5 rounded accent-emerald-700 cursor-pointer" />
            <h3 className="font-semibold text-gray-900 truncate">{supplier.company}</h3>
          </div>
          <Stars rating={supplier.rating} />
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(supplier)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onAddQuote(supplier)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-700" title="Add quote">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-sm">
        {supplier.location && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{supplier.location}</span>
          </div>
        )}
        {supplier.product && (
          <div className="flex flex-wrap gap-1">
            {supplier.product.split(", ").filter(Boolean).map(p => (
              <span key={p} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                {p}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-gray-500">
          <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span>
            <span className="font-semibold text-gray-900">
              {displayPrice != null ? formatINR(displayPrice) : "—"}
            </span>
            {" "}/kg
            {supplier.moq_kg && <span className="text-gray-400"> · MOQ {supplier.moq_kg.toLocaleString()}kg</span>}
          </span>
        </div>
        {supplier.lead_time_days && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>{supplier.lead_time_days} days lead time</span>
          </div>
        )}
        {supplier.payment_terms && (
          <p className="text-xs text-gray-400 truncate">{supplier.payment_terms}</p>
        )}
      </div>

      {/* Certifications */}
      {supplier.certifications?.length ? (
        <div className="flex flex-wrap gap-1">
          {supplier.certifications.map(c => (
            <span key={c} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">{c}</span>
          ))}
        </div>
      ) : null}

      {/* Mini price history */}
      {sorted.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Recent quotes</p>
          <div className="space-y-1">
            {sorted.slice(0, 3).map((q, i) => (
              <div key={q.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{q.quote_date}</span>
                <span className={cn("font-medium", i === 0 ? "text-gray-900" : "text-gray-400")}>
                  {formatINR(q.price_per_kg_inr)}/kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [quotes,    setQuotes]    = useState<QuoteWithSupplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [supplierModal, setSupplierModal] = useState(false);
  const [quoteModal,    setQuoteModal]    = useState(false);
  const [editing,       setEditing]       = useState<Supplier | null>(null);
  const [quoteFor,      setQuoteFor]      = useState<Supplier | null>(null);
  const [selected,      setSelected]      = useState<string[]>([]);
  const [comparing,     setComparing]     = useState(false);
  const [aiResult,      setAiResult]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [{ data: suppData, error: sErr }, { data: quoteData, error: qErr }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("is_active", true).order("rating", { ascending: false }),
      supabase.from("supplier_quotes").select("*, suppliers(company)").order("quote_date", { ascending: false }).limit(50),
    ]);
    if (sErr || qErr) { setError((sErr ?? qErr)!.message); setLoading(false); return; }
    setSuppliers((suppData ?? []) as Supplier[]);
    setQuotes((quoteData ?? []) as QuoteWithSupplier[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Price alerts (>5% change) ────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const msgs: string[] = [];
    suppliers.forEach(s => {
      const sq = quotes
        .filter(q => q.supplier_id === s.id)
        .sort((a, b) => new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime());
      if (sq.length < 2) return;
      const latest = sq[0].price_per_kg_inr;
      const prev   = sq[1].price_per_kg_inr;
      const pct    = ((latest - prev) / prev) * 100;
      if (Math.abs(pct) > 5) {
        msgs.push(`${s.company}: price ${pct > 0 ? "↑" : "↓"}${Math.abs(pct).toFixed(1)}% (${formatINR(prev)} → ${formatINR(latest)}/kg)`);
      }
    });
    return msgs;
  }, [suppliers, quotes]);

  // Quotes grouped by supplier
  const quotesBySupplierId = useMemo(() => {
    const map: Record<string, SupplierQuote[]> = {};
    quotes.forEach(q => { (map[q.supplier_id] = map[q.supplier_id] ?? []).push(q); });
    return map;
  }, [quotes]);

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-3));
  }

  async function handleCompare() {
    const toCompare = suppliers.filter(s => selected.includes(s.id)).slice(0, 3);
    if (toCompare.length < 2) { alert("Select at least 2 suppliers to compare."); return; }
    setComparing(true); setAiResult(null);
    try {
      const res  = await fetch("/api/suppliers/compare", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ suppliers: toCompare }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setAiResult(data.analysis);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  }

  function handleSavedSupplier(s: Supplier) {
    setSuppliers(prev => {
      const idx = prev.findIndex(x => x.id === s.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = s; return n; }
      return [s, ...prev];
    });
  }

  function handleSavedQuote(q: QuoteWithSupplier) {
    setQuotes(prev => [q, ...prev]);
  }

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : <>{suppliers.length} active supplier{suppliers.length !== 1 ? "s" : ""} · <span className="text-amber-600 font-medium">Alerts on &gt;5% price changes</span></>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.length >= 2 && (
            <button className="btn-secondary" onClick={handleCompare} disabled={comparing}>
              {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              AI Compare ({selected.length})
            </button>
          )}
          <Link href="/suppliers/find" className="btn-secondary">
            <Search className="h-4 w-4" /> Find Suppliers
          </Link>
          <button className="btn-secondary" onClick={() => { setQuoteFor(null); setQuoteModal(true); }}>
            <Plus className="h-4 w-4" /> Add Quote
          </button>
          <button className="btn-primary" onClick={() => { setEditing(null); setSupplierModal(true); }}>
            <Plus className="h-4 w-4" /> Add Supplier
          </button>
        </div>
      </div>

      {/* Price alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">Price change alerts</span>
          </div>
          {alerts.map((a, i) => (
            <p key={i} className="text-sm text-amber-700 pl-6">{a}</p>
          ))}
        </div>
      )}

      {/* AI comparison result */}
      {aiResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-800">AI Supplier Analysis</span>
            </div>
            <button onClick={() => setAiResult(null)} className="text-emerald-500 hover:text-emerald-700 text-sm">✕</button>
          </div>
          <p className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">{aiResult}</p>
        </div>
      )}

      {/* Hint */}
      {suppliers.length >= 2 && selected.length < 2 && (
        <p className="text-xs text-gray-400">
          ☑ Select 2–3 suppliers to enable AI comparison
        </p>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="card h-64 animate-pulse bg-gray-100" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No active suppliers yet.</p>
          <button className="mt-3 text-sm text-emerald-700 hover:underline font-medium"
            onClick={() => { setEditing(null); setSupplierModal(true); }}>
            Add your first supplier →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map(s => (
            <SupplierCard
              key={s.id}
              supplier={s}
              quotes={quotesBySupplierId[s.id] ?? []}
              onEdit={sup => { setEditing(sup); setSupplierModal(true); }}
              onAddQuote={sup => { setQuoteFor(sup); setQuoteModal(true); }}
              selected={selected.includes(s.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {supplierModal && (
        <SupplierModal
          supplier={editing}
          onClose={() => { setSupplierModal(false); setEditing(null); }}
          onSaved={handleSavedSupplier}
        />
      )}
      {quoteModal && (
        <QuoteModal
          suppliers={quoteFor ? [quoteFor, ...suppliers.filter(s => s.id !== quoteFor.id)] : suppliers}
          onClose={() => { setQuoteModal(false); setQuoteFor(null); }}
          onSaved={handleSavedQuote}
        />
      )}
    </div>
  );
}
