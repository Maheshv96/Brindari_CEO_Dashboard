"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, ExternalLink, RefreshCw, Ship, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { DetailModal } from "@/components/ui/DetailModal";

import type { Shipment, Order } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type ShipmentRow = Shipment & {
  orders: { order_number: string; product: string; buyers: { company: string } | null } | null;
};
type ActiveOrder = Pick<Order, "id" | "order_number" | "product"> & {
  buyers: { company: string } | null;
};

const TAG_COLORS: Record<string, string> = {
  Pending:          "bg-gray-100 text-gray-600",
  InfoReceived:     "bg-blue-100 text-blue-700",
  InTransit:        "bg-cyan-100 text-cyan-700",
  OutForDelivery:   "bg-orange-100 text-orange-700",
  Delivered:        "bg-green-100 text-green-700",
  Exception:        "bg-red-100 text-red-700",
  AttemptFail:      "bg-red-100 text-red-700",
  Expired:          "bg-gray-100 text-gray-500",
};

const SLUG_SUGGESTIONS = ["fedex", "dhl", "ups", "india-post", "bluedart", "dtdc", "aramex", "maersk", "msc", "cma-cgm"];

// ── Track modal ────────────────────────────────────────────────────────────────
function TrackModal({ orders, onClose, onSaved }: {
  orders: ActiveOrder[];
  onClose: () => void;
  onSaved: (s: ShipmentRow) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({ order_id: "", tracking_number: "", aftership_slug: "", destination_country: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.order_id)          { setErr("Select an order."); return; }
    if (!form.tracking_number)   { setErr("Tracking number required."); return; }
    setSaving(true); setErr(null);
    try {
      const { data, error } = await supabase
        .from("shipments")
        .insert({
          order_id:           form.order_id,
          tracking_number:    form.tracking_number.trim(),
          aftership_slug:     form.aftership_slug.trim() || null,
          status:             "Pending",
          tag:                "Pending",
        })
        .select("*, orders(order_number, product, buyers(company))")
        .single();
      if (error) throw error;
      onSaved(data as ShipmentRow);
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
          <h2 className="text-base font-semibold text-gray-900">Track Shipment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}
          <div>
            <label className="label">Order *</label>
            <select className="input" value={form.order_id} onChange={e => set("order_id", e.target.value)} required>
              <option value="">Select order…</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.buyers?.company ?? "?"} ({o.product})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tracking Number *</label>
            <input className="input font-mono" placeholder="MSCU1234567" value={form.tracking_number} onChange={e => set("tracking_number", e.target.value)} required />
          </div>
          <div>
            <label className="label">Carrier / AfterShip Slug</label>
            <input className="input" placeholder="fedex, dhl, ups, india-post…" value={form.aftership_slug} onChange={e => set("aftership_slug", e.target.value)} list="slugs" />
            <datalist id="slugs">{SLUG_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
            <p className="text-xs text-gray-400 mt-1">Use AfterShip slug format</p>
          </div>
          <div>
            <label className="label">Destination Country</label>
            <CountrySelect value={form.destination_country} onChange={v => set("destination_country", v)} placeholder="Select country…" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const supabase = createClient();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [orders,    setOrders]    = useState<ActiveOrder[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [modal,     setModal]     = useState(false);
  const [tracking,  setTracking]  = useState<string | null>(null);
  const [detail,    setDetail]    = useState<ShipmentRow | null>(null); // shipment id being refreshed

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [{ data: sData, error: sErr }, { data: oData, error: oErr }] = await Promise.all([
      supabase.from("shipments")
        .select("*, orders(order_number, product, buyers(company))")
        .order("updated_at", { ascending: false }),
      supabase.from("orders")
        .select("id, order_number, product, buyers(company)")
        .not("status", "in", '("delivered","cancelled")')
        .order("created_at", { ascending: false }),
    ]);
    if (sErr || oErr) { setError((sErr ?? oErr)!.message); setLoading(false); return; }
    setShipments((sData ?? []) as ShipmentRow[]);
    setOrders((oData ?? []) as unknown as ActiveOrder[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh(s: ShipmentRow) {
    if (!s.tracking_number || !s.aftership_slug) {
      alert("No tracking number or carrier slug set on this shipment.");
      return;
    }
    setTracking(s.id);
    try {
      const res  = await fetch("/api/shipments/track", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ shipmentId: s.id, trackingNumber: s.tracking_number, slug: s.aftership_slug }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setShipments(prev => prev.map(x => x.id === s.id
        ? { ...x, tag: data.tag, status: data.tag, last_update: data.last_update }
        : x
      ));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Track failed");
    } finally {
      setTracking(null);
    }
  }

  const inTransit = shipments.filter(s => !["Delivered", "Expired"].includes(s.tag ?? "")).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : <>{shipments.length} tracked · <span className="font-medium text-cyan-700">{inTransit} in transit</span></>}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" /> Track Shipment
        </button>
      </div>

      {error && <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Tracking #", "Order / Buyer", "Carrier", "Status", "Last Update", "ETA", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-100 w-24" /></td>
                  ))}</tr>
                ))
              ) : shipments.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No shipments tracked yet.{" "}
                  <button className="text-emerald-700 hover:underline" onClick={() => setModal(true)}>Add one →</button>
                </td></tr>
              ) : (
                shipments.map(s => (
                  <tr key={s.id} onClick={() => setDetail(s)} className="group hover:bg-gray-50/50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{s.tracking_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs">{s.orders?.order_number ?? "—"}</p>
                      <p className="text-xs text-gray-400">{s.orders?.buyers?.company ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{s.carrier ?? s.aftership_slug ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", TAG_COLORS[s.tag ?? ""] ?? "bg-gray-100 text-gray-500")}>
                        {s.tag ?? "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-500 truncate" title={s.last_update ?? ""}>
                        {s.last_update ? new Date(s.last_update).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.estimated_delivery ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleRefresh(s)}
                          disabled={tracking === s.id}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-700 disabled:opacity-40"
                          title="Refresh tracking"
                        >
                          {tracking === s.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                        {s.tracking_number && s.aftership_slug && (
                          <a
                            href={`https://www.aftership.com/track/${s.aftership_slug}/${s.tracking_number}`}
                            target="_blank" rel="noopener noreferrer"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                            title="Open on AfterShip"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {shipments.length === 0 && !loading && (
        <div className="text-center py-4">
          <Ship className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">Supports FedEx, DHL, UPS, India Post, BlueDart, Maersk and 900+ carriers via AfterShip</p>
        </div>
      )}

      {modal && (
        <TrackModal
          orders={orders}
          onClose={() => setModal(false)}
          onSaved={s => { setShipments(prev => [s, ...prev]); setModal(false); }}
        />
      )}

      {detail && (
        <DetailModal
          title={detail.tracking_number ?? "No Tracking #"}
          subtitle={detail.orders?.order_number ?? ""}
          badge={detail.tag ? { label: detail.tag, className: TAG_COLORS[detail.tag] ?? "bg-gray-100 text-gray-500" } : undefined}
          onClose={() => setDetail(null)}
          fields={[
            { label: "Tracking Number", value: detail.tracking_number },
            { label: "Carrier",         value: detail.carrier },
            { label: "AfterShip Slug",  value: detail.aftership_slug },
            { label: "Order",           value: detail.orders?.order_number },
            { label: "Buyer",           value: detail.orders?.buyers?.company },
            { label: "Product",         value: detail.orders?.product },
            { label: "Status / Tag",    value: detail.tag },
            { label: "Last Update",     value: detail.last_update ? new Date(detail.last_update).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : null },
            { label: "Estimated Delivery", value: detail.estimated_delivery },
            { label: "Actual Delivery", value: detail.actual_delivery },
          ]}
          actions={<button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>}
        />
      )}
    </div>
  );
}
