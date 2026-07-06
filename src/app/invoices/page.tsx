"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Download, Send, Pencil, Search, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { DetailModal } from "@/components/ui/DetailModal";
import { formatUSD, generateInvoiceNumber, STATUS_COLORS, cn } from "@/lib/utils";
import type { Invoice, Order, Buyer } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type InvoiceRow = Invoice & {
  orders: { order_number: string; product: string; quantity_kg: number; fob_price_usd: number; total_value_usd: number } | null;
  buyers: { company: string; country: string; email: string } | null;
};

type OrderOption = Pick<Order, "id" | "order_number" | "product" | "quantity_kg" | "fob_price_usd" | "total_value_usd" | "buyer_id">;

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
type InvoiceStatus = typeof INVOICE_STATUSES[number];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
};

// ── Inline status select ───────────────────────────────────────────────────────
function StatusSelect({ invoiceId, value, onChange }: {
  invoiceId: string; value: string; onChange: (id: string, val: string) => Promise<void>;
}) {
  const [cur, setCur] = useState(value);
  const [busy, setBusy] = useState(false);
  async function handle(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value; setBusy(true); setCur(next);
    await onChange(invoiceId, next); setBusy(false);
  }
  return (
    <select value={cur} onChange={handle} disabled={busy}
      className={cn("rounded-full border-0 py-0.5 pl-2.5 pr-7 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60",
        STATUS_COLORS[cur] ?? "bg-gray-100 text-gray-600")}>
      {INVOICE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
    </select>
  );
}

// ── Invoice modal ──────────────────────────────────────────────────────────────
function InvoiceModal({ invoice, orders, buyers, onClose, onSaved, defaultOrderId }: {
  invoice: InvoiceRow | null;
  orders: OrderOption[];
  buyers: Buyer[];
  onClose: () => void;
  onSaved: (inv: InvoiceRow) => void;
  defaultOrderId?: string | null;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    invoice_number: "",
    order_id:       "",
    buyer_id:       "",
    issued_date:    new Date().toISOString().slice(0, 10),
    due_date:       "",
    subtotal_usd:   "",
    tax_amount:     "0",
    status:         "draft" as InvoiceStatus,
    notes:          "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setForm({
        invoice_number: invoice.invoice_number,
        order_id:       invoice.order_id,
        buyer_id:       invoice.buyer_id,
        issued_date:    invoice.issued_date,
        due_date:       invoice.due_date ?? "",
        subtotal_usd:   String(invoice.subtotal_usd),
        tax_amount:     String(invoice.tax_amount),
        status:         invoice.status as InvoiceStatus,
        notes:          "",
      });
    } else {
      const newForm = { invoice_number: generateInvoiceNumber(), order_id: "", buyer_id: "", issued_date: new Date().toISOString().slice(0,10), due_date: "", subtotal_usd: "", tax_amount: "0", status: "draft" as InvoiceStatus, notes: "" };
      // Pre-fill from order if coming from Orders page
      if (defaultOrderId) {
        const o = orders.find(x => x.id === defaultOrderId);
        if (o) { newForm.order_id = o.id; newForm.buyer_id = o.buyer_id; newForm.subtotal_usd = String(o.total_value_usd); }
      }
      setForm(newForm);
    }
    setErr(null);
  }, [invoice, defaultOrderId, orders]);

  // Auto-fill buyer + subtotal when order changes
  function handleOrderChange(orderId: string) {
    const o = orders.find(x => x.id === orderId);
    setForm(f => ({
      ...f,
      order_id:     orderId,
      buyer_id:     o ? o.buyer_id : f.buyer_id,
      subtotal_usd: o ? String(o.total_value_usd) : f.subtotal_usd,
    }));
  }

  const subtotal = parseFloat(form.subtotal_usd) || 0;
  const tax      = parseFloat(form.tax_amount)   || 0;
  const total    = subtotal + tax;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.buyer_id) { setErr("Please select a buyer."); return; }
    if (!form.order_id) { setErr("Please link an order."); return; }
    setSaving(true); setErr(null);

    const payload = {
      invoice_number: form.invoice_number,
      order_id:       form.order_id,
      buyer_id:       form.buyer_id,
      issued_date:    form.issued_date,
      due_date:       form.due_date || null,
      subtotal_usd:   subtotal,
      tax_amount:     tax,
      total_usd:      total,
      status:         form.status,
    };

    try {
      if (invoice) {
        const { data, error } = await supabase.from("invoices").update(payload).eq("id", invoice.id)
          .select("*, orders(order_number, product, quantity_kg, fob_price_usd, total_value_usd), buyers(company, country, email)").single();
        if (error) throw error;
        onSaved(data as InvoiceRow);
      } else {
        const { data, error } = await supabase.from("invoices").insert(payload)
          .select("*, orders(order_number, product, quantity_kg, fob_price_usd, total_value_usd), buyers(company, country, email)").single();
        if (error) throw error;
        onSaved(data as InvoiceRow);
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
            {invoice ? `Edit — ${invoice.invoice_number}` : "New Invoice"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{err}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Invoice Number</label>
              <input className="input font-mono" value={form.invoice_number} onChange={e => set("invoice_number", e.target.value)} required />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                {INVOICE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Link to Order *</label>
            <select className="input" value={form.order_id} onChange={e => handleOrderChange(e.target.value)} required>
              <option value="">Select order…</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.product} ({formatUSD(o.total_value_usd)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Buyer</label>
            <select className="input" value={form.buyer_id} onChange={e => set("buyer_id", e.target.value)} required>
              <option value="">Select buyer…</option>
              {buyers.map(b => <option key={b.id} value={b.id}>{b.company} ({b.country})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Issue Date</label>
              <input className="input" type="date" value={form.issued_date} onChange={e => set("issued_date", e.target.value)} required />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Subtotal (USD)</label>
              <input className="input" type="number" step="0.01" min="0" value={form.subtotal_usd} onChange={e => set("subtotal_usd", e.target.value)} required />
            </div>
            <div>
              <label className="label">Tax / Charges</label>
              <input className="input" type="number" step="0.01" min="0" value={form.tax_amount} onChange={e => set("tax_amount", e.target.value)} />
            </div>
            <div>
              <label className="label">Total (USD)</label>
              <div className="input bg-gray-50 font-semibold text-emerald-700 cursor-default">{total > 0 ? formatUSD(total) : "—"}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : invoice ? "Save Changes" : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const supabase     = createClient();

  const [invoices, setInvoices]   = useState<InvoiceRow[]>([]);
  const [orders,   setOrders]     = useState<OrderOption[]>([]);
  const [buyers,   setBuyers]     = useState<Buyer[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState<string | null>(null);
  const [search,   setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editing,        setEditing]        = useState<InvoiceRow | null>(null);
  const [defaultOrderId, setDefaultOrderId] = useState<string | null>(null);
  const [detail,    setDetail]    = useState<InvoiceRow | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [
      { data: invData, error: iErr },
      { data: ordData, error: oErr },
      { data: buyData, error: bErr },
    ] = await Promise.all([
      supabase.from("invoices")
        .select("*, orders(order_number, product, quantity_kg, fob_price_usd, total_value_usd), buyers(company, country, email)")
        .order("created_at", { ascending: false }),
      supabase.from("orders").select("id, order_number, product, quantity_kg, fob_price_usd, total_value_usd, buyer_id").order("created_at", { ascending: false }),
      supabase.from("buyers").select("*").order("company"),
    ]);
    if (iErr || oErr || bErr) { setError((iErr ?? oErr ?? bErr)!.message); setLoading(false); return; }
    setInvoices((invData ?? []) as InvoiceRow[]);
    setOrders((ordData ?? []) as OrderOption[]);
    setBuyers((buyData ?? []) as Buyer[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("action") === "new") {
        setEditing(null);
        setModalOpen(true);
        // If coming from Orders page, pre-select the order
        const orderId = p.get("order_id");
        if (orderId) setDefaultOrderId(orderId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Status summary ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const map = {} as Record<string, { count: number; total: number }>;
    for (const s of INVOICE_STATUSES) map[s] = { count: 0, total: 0 };
    invoices.forEach(i => { map[i.status].count++; map[i.status].total += i.total_usd; });
    return map;
  }, [invoices]);

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(i => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (q) return (
        i.invoice_number.toLowerCase().includes(q) ||
        (i.buyers?.company ?? "").toLowerCase().includes(q) ||
        (i.orders?.order_number ?? "").toLowerCase().includes(q)
      );
      return true;
    });
  }, [invoices, search, statusFilter]);

  const outstanding = useMemo(
    () => invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total_usd, 0),
    [invoices]
  );
  const paid = invoices.filter(i => i.status === "paid").length;

  // ── Inline status update ─────────────────────────────────────────────────
  async function handleStatusChange(id: string, val: string) {
    const extra: Record<string, unknown> = {};
    if (val === "paid") extra.paid_at = new Date().toISOString();
    await supabase.from("invoices").update({ status: val, ...extra }).eq("id", id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: val as Invoice["status"], ...extra } : i));
  }

  // ── PDF download ─────────────────────────────────────────────────────────
  async function handleDownloadPDF(invoice: InvoiceRow) {
    setPdfLoading(invoice.id);
    try {
      // Pass full invoice object so the API doesn't need the service role key
      const res  = await fetch("/api/invoices/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }

      // Dynamic import pdfmake (client-side only)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfMake  = (await import("pdfmake/build/pdfmake")) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
      pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.default?.vfs ?? pdfFonts.vfs;
      pdfMake.createPdf(data.docDefinition).download(`${data.invoice_number}.pdf`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setPdfLoading(null);
    }
  }

  // ── Send email ───────────────────────────────────────────────────────────
  async function handleSend(invoice: InvoiceRow) {
    if (!confirm(`Send invoice ${invoice.invoice_number} to ${invoice.buyers?.email}?`)) return;
    setSendLoading(invoice.id);
    try {
      const res  = await fetch("/api/invoices/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: invoice.id }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, status: "sent" as Invoice["status"] } : i));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSendLoading(null);
    }
  }

  function handleSaved(saved: InvoiceRow) {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : <>{paid} paid · <span className="font-medium text-orange-600">{formatUSD(outstanding)} outstanding</span></>}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {INVOICE_STATUSES.map(s => (
          <button key={s}
            onClick={() => setStatusFilter(f => f === s ? "" : s)}
            className={cn(
              "card p-4 text-left transition-all hover:shadow-md",
              statusFilter === s && "ring-2 ring-emerald-500"
            )}>
            <p className={cn("text-xs font-semibold uppercase tracking-wide", STATUS_COLORS[s]?.replace("bg-", "text-").replace(/text-\S+\s/, ""))}>{STATUS_LABELS[s]}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{summary[s]?.count ?? 0}</p>
            <p className="mt-0.5 text-xs text-gray-400">{formatUSD(summary[s]?.total ?? 0)}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search invoice #, buyer, order…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter("")} className="text-sm text-gray-500 hover:text-gray-700">✕ Clear</button>
        )}
      </div>

      {error && <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                {["Invoice #", "Buyer", "Order Ref", "Issued", "Due", "Total", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: `${50 + (j * 13) % 40}%` }} /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  {invoices.length === 0
                    ? <><button className="text-emerald-700 hover:underline" onClick={() => { setEditing(null); setModalOpen(true); }}>Create your first invoice →</button></>
                    : "No invoices match your filters."}
                </td></tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} onClick={() => setDetail(inv)} className="group hover:bg-gray-50/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{inv.invoice_number}</td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{inv.buyers?.company ?? "—"}</p>
                      <p className="text-xs text-gray-400">{inv.buyers?.email ?? ""}</p>
                    </td>

                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{inv.orders?.order_number ?? "—"}</td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>

                    <td className={cn("px-4 py-3 whitespace-nowrap", inv.status === "overdue" ? "text-red-600 font-medium" : "text-gray-500")}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>

                    <td className="px-4 py-3 font-semibold tabular-nums text-gray-900">{formatUSD(inv.total_usd)}</td>

                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <StatusSelect invoiceId={inv.id} value={inv.status} onChange={handleStatusChange} />
                    </td>

                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Download PDF */}
                        <button
                          onClick={() => handleDownloadPDF(inv)}
                          disabled={pdfLoading === inv.id}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-700 disabled:opacity-40"
                          title="Download PDF"
                        >
                          {pdfLoading === inv.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                        </button>

                        {/* Send email */}
                        <button
                          onClick={() => handleSend(inv)}
                          disabled={sendLoading === inv.id || !inv.buyers?.email}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40"
                          title={inv.buyers?.email ? "Send to buyer" : "No buyer email"}
                        >
                          {sendLoading === inv.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Send className="h-3.5 w-3.5" />}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => { setEditing(inv); setModalOpen(true); }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit invoice"
                        >
                          <Pencil className="h-3.5 w-3.5" />
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
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{filtered.length} invoices</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-gray-900">
                    {formatUSD(filtered.reduce((s, i) => s + i.total_usd, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modalOpen && (
        <InvoiceModal
          invoice={editing}
          orders={orders}
          buyers={buyers}
          onClose={() => { setModalOpen(false); setEditing(null); setDefaultOrderId(null); }}
          onSaved={handleSaved}
          defaultOrderId={defaultOrderId}
        />
      )}

      {detail && (
        <DetailModal
          title={detail.invoice_number}
          subtitle={detail.buyers?.company ?? ""}
          badge={{ label: detail.status.toUpperCase(), className: STATUS_COLORS[detail.status] ?? "bg-gray-100 text-gray-600" }}
          onClose={() => setDetail(null)}
          fields={[
            { label: "Invoice Number",  value: detail.invoice_number },
            { label: "Buyer",           value: detail.buyers?.company },
            { label: "Buyer Email",     value: detail.buyers?.email },
            { label: "Order Ref",       value: detail.orders?.order_number },
            { label: "Product",         value: detail.orders?.product },
            { label: "Issued Date",     value: detail.issued_date },
            { label: "Due Date",        value: detail.due_date },
            { label: "Subtotal",        value: formatUSD(detail.subtotal_usd) },
            { label: "Tax / Charges",   value: formatUSD(detail.tax_amount) },
            { label: "Total Due",       value: formatUSD(detail.total_usd), highlight: true },
            { label: "Status",          value: detail.status },
            { label: "Paid At",         value: detail.paid_at ? new Date(detail.paid_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : null },
            { label: "Sent At",         value: detail.sent_at ? new Date(detail.sent_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : null },
          ]}
          actions={<><button className="btn-secondary" onClick={() => setDetail(null)}>Close</button><button className="btn-primary" onClick={() => { setDetail(null); setEditing(detail); setModalOpen(true); }}>Edit Invoice</button></>}
        />
      )}
    </div>
  );
}
