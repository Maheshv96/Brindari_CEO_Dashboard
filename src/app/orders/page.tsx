"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, ExternalLink, Pencil, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatUSD, STATUS_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Order, Buyer } from "@/lib/supabase";
import { OrderModal } from "@/components/orders/OrderModal";
import { DetailModal } from "@/components/ui/DetailModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderRow = Order & { buyers: { company: string; country: string } | null };

// ── Pipeline statuses in display order ───────────────────────────────────────
const PIPELINE_STATUSES = [
  "confirmed",
  "in-production",
  "quality-check",
  "ready-to-ship",
  "shipped",
  "in-transit",
  "delivered",
  "cancelled",
] as const;

type PipelineStatus = typeof PIPELINE_STATUSES[number];

// ── Inline status select ──────────────────────────────────────────────────────
function StatusSelect({
  orderId,
  value,
  onChange,
}: {
  orderId: string;
  value: string;
  onChange: (id: string, val: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving]   = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setSaving(true);
    setCurrent(next);
    await onChange(orderId, next);
    setSaving(false);
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      className={cn(
        "rounded-full border-0 py-0.5 pl-2.5 pr-7 text-xs font-medium cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500",
        "disabled:opacity-60 disabled:cursor-wait",
        STATUS_COLORS[current] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {PIPELINE_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase     = createClient();
  const router       = useRouter();

  const [orders, setOrders]         = useState<OrderRow[]>([]);
  const [buyers, setBuyers]         = useState<Buyer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus | null>(null);
  const [statusFilter, setStatusFilter]     = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<OrderRow | null>(null);
  const [detail, setDetail]         = useState<OrderRow | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: ordersData, error: oErr }, { data: buyersData, error: bErr }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*, buyers(company, country)")
          .order("created_at", { ascending: false }),
        supabase.from("buyers").select("*").order("company"),
      ]);
    if (oErr) { setError(oErr.message); setLoading(false); return; }
    if (bErr) { setError(bErr.message); setLoading(false); return; }
    setOrders((ordersData ?? []) as OrderRow[]);
    setBuyers((buyersData ?? []) as Buyer[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("action") === "new") { setEditing(null); setModalOpen(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pipeline counts ───────────────────────────────────────────────────────
  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of PIPELINE_STATUSES) map[s] = 0;
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (pipelineFilter && o.status !== pipelineFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (q) {
        return (
          o.order_number.toLowerCase().includes(q) ||
          (o.buyers?.company ?? "").toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, pipelineFilter, statusFilter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, o) => s + o.total_value_usd, 0),
    [filtered]
  );

  // ── Inline status update ──────────────────────────────────────────────────
  async function handleStatusChange(id: string, newStatus: string) {
    const { error: err } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", id);
    if (!err) {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: newStatus as Order["status"] } : o))
      );
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string, orderNum: string) {
    if (!confirm(`Delete order ${orderNum}? This cannot be undone.`)) return;
    const { error: err } = await supabase.from("orders").delete().eq("id", id);
    if (err) { alert(err.message); return; }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  // ── Modal save ────────────────────────────────────────────────────────────
  function handleSaved(saved: OrderRow) {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : (
              <>
                {filtered.length} order{filtered.length !== 1 ? "s" : ""}
                {" · "}
                <span className="font-medium text-gray-700">{formatUSD(filteredTotal)} total</span>
                {pipelineFilter || statusFilter || search
                  ? " (filtered)"
                  : ` of ${orders.length} total`}
              </>
            )}
          </p>
        </div>
        <button
          className="btn-primary shrink-0"
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          <Plus className="h-4 w-4" /> New Order
        </button>
      </div>

      {/* Pipeline summary bar */}
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setPipelineFilter((prev) => (prev === s ? null : s))}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              STATUS_COLORS[s] ?? "bg-gray-100 text-gray-600",
              pipelineFilter === s && "ring-2 ring-emerald-500 ring-offset-1"
            )}
          >
            <span>{s}</span>
            <span className="rounded-full bg-white/50 px-1.5 py-0.5 text-xs font-bold leading-none">
              {pipelineCounts[s] ?? 0}
            </span>
          </button>
        ))}
        {pipelineFilter && (
          <button
            onClick={() => setPipelineFilter(null)}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Search + status filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search order #, buyer, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-44"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPipelineFilter(null); }}
        >
          <option value="">All statuses</option>
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Order #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Buyer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Product</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Qty (kg)</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">FOB/kg</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Ship Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: `${60 + (j * 17) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    {orders.length === 0
                      ? <>No orders yet. <button className="text-emerald-700 hover:underline" onClick={() => { setEditing(null); setModalOpen(true); }}>Create your first order →</button></>
                      : "No orders match your filters."
                    }
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} onClick={() => setDetail(order)} className="group hover:bg-gray-50/50 transition-colors cursor-pointer">

                    {/* Order # */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-gray-900">
                        {order.order_number}
                      </span>
                    </td>

                    {/* Buyer */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{order.buyers?.company ?? "—"}</p>
                      <p className="text-xs text-gray-400">{order.buyers?.country ?? ""}</p>
                    </td>

                    {/* Product */}
                    <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">
                      {order.product}
                    </td>

                    {/* Qty */}
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {Number(order.quantity_kg).toLocaleString()}
                    </td>

                    {/* FOB/kg */}
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      ${Number(order.fob_price_usd).toFixed(2)}
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                      {formatUSD(order.total_value_usd)}
                    </td>

                    {/* Shipment date */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {order.shipment_date
                        ? new Date(order.shipment_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>

                    {/* Inline status select */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <StatusSelect
                        orderId={order.id}
                        value={order.status}
                        onChange={handleStatusChange}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {order.tracking_number && (
                          <a
                            href={`https://www.aftership.com/track/${order.aftership_slug ?? ""}/${order.tracking_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-700"
                            title="Track shipment"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          className="rounded p-1.5 text-gray-400 hover:bg-yellow-50 hover:text-yellow-700"
                          title="Create invoice for this order"
                          onClick={() => router.push(`/invoices?action=new&order_id=${order.id}`)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit order"
                          onClick={() => { setEditing(order); setModalOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete order"
                          onClick={() => handleDelete(order.id, order.order_number)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Footer total row */}
            {filtered.length > 1 && !loading && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {filtered.length} orders
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                    {formatUSD(filteredTotal)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <OrderModal
          order={editing}
          buyers={buyers}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {detail && (
        <DetailModal
          title={detail.order_number}
          subtitle={detail.buyers?.company ?? ""}
          badge={{ label: detail.status, className: STATUS_COLORS[detail.status] ?? "bg-gray-100 text-gray-600" }}
          onClose={() => setDetail(null)}
          fields={[
            { label: "Order Number",    value: detail.order_number },
            { label: "Buyer",           value: detail.buyers?.company },
            { label: "Country",         value: detail.buyers?.country },
            { label: "Product",         value: detail.product },
            { label: "Quantity (kg)",   value: Number(detail.quantity_kg).toLocaleString() },
            { label: "FOB Price / kg",  value: "$" + Number(detail.fob_price_usd).toFixed(4) },
            { label: "Total Value",     value: formatUSD(detail.total_value_usd), highlight: true },
            { label: "Incoterm",        value: detail.incoterm },
            { label: "HS Code",         value: detail.hs_code },
            { label: "Payment Terms",   value: detail.payment_terms },
            { label: "Payment Status",  value: detail.payment_status },
            { label: "Shipment Date",   value: detail.shipment_date },
            { label: "Est. Arrival",    value: detail.estimated_arrival },
            { label: "Destination Port",value: detail.destination_port },
            { label: "Tracking #",      value: detail.tracking_number },
            { label: "Notes",           value: detail.notes, wide: true },
          ]}
          actions={<><button className="btn-secondary" onClick={() => setDetail(null)}>Close</button><button className="btn-primary" onClick={() => { setDetail(null); setEditing(detail); setModalOpen(true); }}>Edit Order</button></>}
        />
      )}
    </div>
  );
}
