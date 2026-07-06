"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Star, ArrowRightCircle, CheckCircle, Download, LayoutGrid, List, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatUSD, STATUS_COLORS, PRODUCTS, cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { OrderModal } from "@/components/orders/OrderModal";
import { DetailModal } from "@/components/ui/DetailModal";
import type { Lead, Buyer, Order } from "@/lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────
const LEAD_STATUSES = ["new", "contacted", "qualified", "negotiating", "closed", "lost"] as const;
const LEAD_SOURCES  = ["website", "referral", "email", "cold_outreach", "event", "social", "other"] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  negotiating: "Negotiating", closed: "Closed (Won)", lost: "Lost",
};

// ── Inline status select ──────────────────────────────────────────────────────
function StatusSelect({ leadId, value, onChange }: {
  leadId: string; value: string; onChange: (id: string, v: string) => void;
}) {
  return (
    <select value={value} onChange={e => onChange(leadId, e.target.value)}
      className={cn("rounded-full border-0 py-0.5 pl-2.5 pr-7 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500",
        STATUS_COLORS[value] ?? "bg-gray-100 text-gray-600")}>
      {LEAD_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  );
}

// ── Lead modal ────────────────────────────────────────────────────────────────
const EMPTY = {
  company: "", contact_name: "", email: "", phone: "", country: "",
  product_interest: [] as string[], status: "new" as Lead["status"], source: "",
  deal_value_usd: "", lead_score: "", notes: "",
};

function LeadModal({ lead, onClose, onSaved }: {
  lead: Lead | null;
  onClose: () => void;
  onSaved: (l: Lead) => void;
}) {
  const supabase = createClient();
  const [form, setForm]     = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    setForm(lead ? {
      company:          lead.company,
      contact_name:     lead.contact_name,
      email:            lead.email ?? "",
      phone:            lead.phone ?? "",
      country:          lead.country,
      product_interest: (lead.product_interest ?? "").split(", ").filter(Boolean),
      status:           lead.status,
      source:           lead.source ?? "",
      deal_value_usd:   lead.deal_value_usd != null ? String(lead.deal_value_usd) : "",
      lead_score:       lead.lead_score != null ? String(lead.lead_score) : "",
      notes:            lead.notes ?? "",
    } : { ...EMPTY });
    setErr(null);
  }, [lead]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim())      { setErr("Company is required."); return; }
    if (!form.contact_name.trim()) { setErr("Contact name is required."); return; }
    if (!form.country.trim())      { setErr("Country is required."); return; }
    setSaving(true); setErr(null);

    const payload = {
      company:          form.company,
      contact_name:     form.contact_name,
      email:            form.email || null,
      phone:            form.phone || null,
      country:          form.country,
      product_interest: form.product_interest.length ? form.product_interest.join(", ") : null,
      status:           form.status,
      source:           form.source || null,
      deal_value_usd:   form.deal_value_usd ? Number(form.deal_value_usd) : null,
      lead_score:       form.lead_score ? Math.min(100, Math.max(0, Number(form.lead_score))) : null,
      notes:            form.notes || null,
    };

    try {
      const q = lead
        ? supabase.from("leads").update(payload).eq("id", lead.id).select().single()
        : supabase.from("leads").insert(payload).select().single();
      const { data, error } = await q;
      if (error) throw error;
      onSaved(data as Lead);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{lead ? `Edit — ${lead.company}` : "Add Lead"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company *</label>
              <input className="input" placeholder="Acme Health GmbH" value={form.company} onChange={e => set("company", e.target.value)} required />
            </div>
            <div>
              <label className="label">Contact Name *</label>
              <input className="input" placeholder="Maria Schmidt" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="maria@acme.de" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+49 30 000 0000" value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">Country *</label>
              <CountrySelect value={form.country} onChange={v => set("country", v)} required />
            </div>
            <div>
              <label className="label">Product Interest</label>
              <MultiSelect
                options={PRODUCTS}
                value={form.product_interest}
                onChange={v => setForm(f => ({ ...f, product_interest: v }))}
                placeholder="Select products…"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={form.source} onChange={e => set("source", e.target.value)}>
                <option value="">Select source…</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Deal Value (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input className="input pl-6" type="number" min="0" step="0.01" placeholder="50000" value={form.deal_value_usd} onChange={e => set("deal_value_usd", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Lead Score (0–100)</label>
              <input className="input" type="number" min="0" max="100" placeholder="75" value={form.lead_score} onChange={e => set("lead_score", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input min-h-[72px] resize-y" placeholder="Any context, requirements, or follow-up notes…" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : lead ? "Save Changes" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pipeline summary ──────────────────────────────────────────────────────────
function PipelineSummary({ leads, active, onFilter }: {
  leads: Lead[]; active: string; onFilter: (s: string) => void;
}) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach(l => { m[l.status] = (m[l.status] ?? 0) + 1; });
    return m;
  }, [leads]);

  return (
    <div className="flex flex-wrap gap-2">
      {LEAD_STATUSES.map(s => (
        <button key={s} onClick={() => onFilter(active === s ? "" : s)}
          className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            STATUS_COLORS[s] ?? "bg-gray-100 text-gray-600",
            active === s && "ring-2 ring-emerald-500 ring-offset-1")}>
          {STATUS_LABEL[s]}
          <span className="rounded-full bg-white/50 px-1.5 py-0.5 text-xs font-bold leading-none">
            {counts[s] ?? 0}
          </span>
        </button>
      ))}
      {active && (
        <button onClick={() => onFilter("")} className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100">
          ✕ Clear
        </button>
      )}
    </div>
  );
}

type OrderRow = Order & { buyers: { company: string; country: string } | null };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const supabase     = createClient();
  const [leads,    setLeads]   = useState<Lead[]>([]);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState<string | null>(null);
  const [search,   setSearch]  = useState("");
  const [statusF,  setStatusF] = useState("");
  const [sortBy,   setSortBy]  = useState<"created_at" | "deal_value_usd" | "lead_score">("created_at");
  const [sortDir,  setSortDir] = useState<"desc" | "asc">("desc");
  const [modal,    setModal]   = useState(false);
  const [editing,  setEditing] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [detail,   setDetail]  = useState<Lead | null>(null);

  // Convert-to-order state
  const [orderModal,    setOrderModal]    = useState(false);
  const [orderBuyers,   setOrderBuyers]   = useState<Buyer[]>([]);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [converting,    setConverting]    = useState<string | null>(null); // lead id
  const [toast,         setToast]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase
      .from("leads").select("*").order("created_at", { ascending: false });
    if (err) { setError(err.message); } else { setLeads((data ?? []) as Lead[]); }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open modal when arriving from overview quick action
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("action") === "new") setModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...leads]
      .filter(l => {
        if (statusF && l.status !== statusF) return false;
        if (!q) return true;
        return (
          l.company.toLowerCase().includes(q) ||
          l.contact_name.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const av = (a[sortBy] ?? 0) as number | string;
        const bv = (b[sortBy] ?? 0) as number | string;
        return sortDir === "desc" ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
      });
  }, [leads, search, statusF, sortBy, sortDir]);

  const totalPipeline = useMemo(
    () => filtered.reduce((s, l) => s + (l.deal_value_usd ?? 0), 0),
    [filtered]
  );

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("desc"); }
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from("leads").update({ status }).eq("id", id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: status as Lead["status"] } : l));
  }

  async function handleDelete(id: string, company: string) {
    if (!confirm(`Delete lead for ${company}? This cannot be undone.`)) return;
    await supabase.from("leads").delete().eq("id", id);
    setLeads(prev => prev.filter(l => l.id !== id));
  }

  function handleSaved(saved: Lead) {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === saved.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [saved, ...prev];
    });
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleConvert(lead: Lead) {
    setConverting(lead.id);
    try {
      // 1. Find or create buyer
      let buyer: Buyer | null = null;

      // Try match by lead_id first, then email
      let existingQuery = supabase
        .from("buyers")
        .select("*")
        .eq("lead_id", lead.id);
      if (lead.email) {
        existingQuery = supabase
          .from("buyers")
          .select("*")
          .or(`lead_id.eq.${lead.id},email.eq.${lead.email}`);
      }
      const { data: existing } = await existingQuery.limit(1).maybeSingle();

      if (existing) {
        buyer = existing as Buyer;
      } else {
        // Auto-create buyer from lead data
        const { data: created, error: cErr } = await supabase
          .from("buyers")
          .insert({
            lead_id:      lead.id,
            company:      lead.company,
            contact_name: lead.contact_name,
            email:        lead.email ?? `${lead.company.toLowerCase().replace(/\s+/g, ".")}@unknown.com`,
            country:      lead.country,
          })
          .select()
          .single();
        if (cErr) throw cErr;
        buyer = created as Buyer;
      }

      // 2. Fetch all buyers for the dropdown (buyer we found/created goes first)
      const { data: allBuyers } = await supabase
        .from("buyers").select("*").order("company");
      const buyerList = [
        buyer,
        ...((allBuyers ?? []) as Buyer[]).filter(b => b.id !== buyer!.id),
      ];

      setOrderBuyers(buyerList);
      setConvertingLead(lead);
      setOrderModal(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConverting(null);
    }
  }

  async function handleOrderSaved(savedOrder: OrderRow) {
    // Mark lead as closed
    if (convertingLead) {
      await supabase.from("leads").update({ status: "closed" }).eq("id", convertingLead.id);
      setLeads(prev => prev.map(l =>
        l.id === convertingLead.id ? { ...l, status: "closed" as Lead["status"] } : l
      ));
    }
    setOrderModal(false);
    setConvertingLead(null);
    setToast(`✓ Lead converted — Order ${savedOrder.order_number} created successfully`);
  }

  const SortHead = ({ field, children }: { field: typeof sortBy; children: React.ReactNode }) => (
    <th onClick={() => toggleSort(field)}
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer select-none whitespace-nowrap hover:text-gray-700">
      {children}{" "}
      <span className="text-gray-300">{sortBy === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : (
              <>{filtered.length} lead{filtered.length !== 1 ? "s" : ""}
                {(statusF || search) && ` (filtered)`}
                {" · "}<span className="font-medium text-gray-700">Pipeline: {formatUSD(totalPipeline)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setViewMode("table")}
              className={cn("px-2.5 py-1.5 transition-colors", viewMode === "table" ? "bg-emerald-700 text-white" : "bg-white text-gray-400 hover:text-gray-600")}
              title="Table view"><List className="h-4 w-4" /></button>
            <button onClick={() => setViewMode("kanban")}
              className={cn("px-2.5 py-1.5 transition-colors", viewMode === "kanban" ? "bg-emerald-700 text-white" : "bg-white text-gray-400 hover:text-gray-600")}
              title="Kanban view"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <Link href="/leads/import" className="btn-secondary">
            <Download className="h-4 w-4" /> Import Leads
          </Link>
          <button className="btn-primary" onClick={() => { setEditing(null); setModal(true); }}>
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Pipeline chips */}
      <PipelineSummary leads={leads} active={statusF} onFilter={setStatusF} />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search company, contact, country…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {error && <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(["new","contacted","qualified","negotiating","closed"] as const).map(status => {
            const cols = filtered.filter(l => l.status === status);
            const stageColors: Record<string, string> = {
              new: "border-blue-200 bg-blue-50", contacted: "border-indigo-200 bg-indigo-50",
              qualified: "border-purple-200 bg-purple-50", negotiating: "border-orange-200 bg-orange-50",
              closed: "border-emerald-200 bg-emerald-50",
            };
            const headColors: Record<string, string> = {
              new: "text-blue-700", contacted: "text-indigo-700", qualified: "text-purple-700",
              negotiating: "text-orange-700", closed: "text-emerald-700",
            };
            return (
              <div key={status} className={cn("rounded-xl border-2 p-3 min-h-[200px]", stageColors[status])}>
                <div className="flex items-center justify-between mb-3">
                  <span className={cn("text-xs font-bold uppercase tracking-wide", headColors[status])}>
                    {STATUS_LABEL[status]}
                  </span>
                  <span className={cn("text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center bg-white", headColors[status])}>
                    {cols.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {cols.map(lead => {
                    const stale = ["new","contacted"].includes(lead.status) &&
                      (Date.now() - new Date(lead.created_at).getTime()) / 86400000 > 7;
                    return (
                      <div key={lead.id} className="rounded-lg bg-white border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => { setEditing(lead); setModal(true); }}>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-xs font-semibold text-gray-900 leading-tight">{lead.company}</p>
                          {stale && <span title="No contact in 7+ days"><Clock className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" /></span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{lead.contact_name}</p>
                        {lead.deal_value_usd != null && (
                          <p className="text-xs font-medium text-gray-700 mt-1.5">{formatUSD(lead.deal_value_usd)}</p>
                        )}
                        {(lead.status === "qualified" || lead.status === "negotiating") && (
                          <button className="mt-2 w-full flex items-center justify-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-800"
                            onClick={e => { e.stopPropagation(); handleConvert(lead); }}>
                            <ArrowRightCircle className="h-3 w-3" /> Convert
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {cols.length === 0 && (
                    <p className="text-xs text-center text-gray-400 py-4">No leads</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {viewMode === "table" && <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Product</th>
                <SortHead field="lead_score">Score</SortHead>
                <SortHead field="deal_value_usd">Value</SortHead>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <SortHead field="created_at">Added</SortHead>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-100 w-20" /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  {leads.length === 0
                    ? <><button className="text-emerald-700 hover:underline font-medium" onClick={() => { setEditing(null); setModal(true); }}>Add your first lead →</button></>
                    : "No leads match your filters."}
                </td></tr>
              ) : (
                filtered.map(lead => (
                  <tr key={lead.id} onClick={() => setDetail(lead)} className="group hover:bg-gray-50/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{lead.company}</p>
                      {lead.source && <p className="text-xs text-gray-400 capitalize">{lead.source.replace("_", " ")}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{lead.contact_name}</p>
                      {lead.email && <p className="text-xs text-gray-400">{lead.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{lead.country}</td>
                    <td className="px-4 py-3">
                      {lead.product_interest
                        ? <div className="flex flex-wrap gap-1">
                            {lead.product_interest.split(", ").filter(Boolean).map(p => (
                              <span key={p} className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 whitespace-nowrap">{p}</span>
                            ))}
                          </div>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {lead.lead_score != null ? (
                        <div className="flex items-center gap-1">
                          <Star className={cn("h-3 w-3", lead.lead_score >= 70 ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
                          <span className="text-xs font-medium text-gray-700">{lead.lead_score}</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sm font-medium text-gray-900">
                      {lead.deal_value_usd != null ? formatUSD(lead.deal_value_usd) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect leadId={lead.id} value={lead.status} onChange={handleStatusChange} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Convert to Order — only for qualified / negotiating */}
                        {(lead.status === "qualified" || lead.status === "negotiating") && (
                          <button
                            onClick={() => handleConvert(lead)}
                            disabled={converting === lead.id}
                            className="flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                            title="Convert to order"
                          >
                            {converting === lead.id
                              ? <span className="animate-spin text-xs">⟳</span>
                              : <ArrowRightCircle className="h-3.5 w-3.5" />}
                            Convert
                          </button>
                        )}
                        <button onClick={() => { setEditing(lead); setModal(true); }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(lead.id, lead.company)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 1 && !loading && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {filtered.length} leads
                  </td>
                  <td className="px-4 py-3 font-bold tabular-nums text-gray-900">{formatUSD(totalPipeline)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>}

      {modal && (
        <LeadModal
          lead={editing}
          onClose={() => { setModal(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Order modal pre-filled from lead conversion */}
      {orderModal && convertingLead && (
        <OrderModal
          order={null}
          buyers={orderBuyers}
          onClose={() => { setOrderModal(false); setConvertingLead(null); }}
          onSaved={handleOrderSaved}
          defaultBuyerId={orderBuyers[0]?.id}
          defaultProduct={convertingLead.product_interest?.split(", ")[0] ?? undefined}
        />
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      )}

      {/* Lead detail drawer */}
      {detail && (
        <DetailModal
          title={detail.company}
          subtitle={detail.contact_name}
          badge={{ label: STATUS_LABEL[detail.status], className: STATUS_COLORS[detail.status] ?? "bg-gray-100 text-gray-600" }}
          onClose={() => setDetail(null)}
          fields={[
            { label: "Contact Name",    value: detail.contact_name },
            { label: "Company",         value: detail.company },
            { label: "Email",           value: detail.email },
            { label: "Phone",           value: detail.phone },
            { label: "Country",         value: detail.country },
            { label: "Product Interest",value: detail.product_interest },
            { label: "Status",          value: STATUS_LABEL[detail.status] },
            { label: "Source",          value: detail.source?.replace(/_/g, " ") },
            { label: "Deal Value",      value: detail.deal_value_usd != null ? formatUSD(detail.deal_value_usd) : null, highlight: true },
            { label: "Lead Score",      value: detail.lead_score != null ? `${detail.lead_score} / 100` : null },
            { label: "Added",           value: new Date(detail.created_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) },
            { label: "Last Updated",    value: new Date(detail.updated_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) },
            { label: "Notes",           value: detail.notes, wide: true },
          ]}
          actions={
            <>
              <button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>
              <button className="btn-primary" onClick={() => { setDetail(null); setEditing(detail); setModal(true); }}>Edit Lead</button>
            </>
          }
        />
      )}
    </div>
  );
}
