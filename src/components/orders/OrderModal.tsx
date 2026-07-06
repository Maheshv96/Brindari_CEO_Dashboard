"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  generateOrderNumber,
  formatUSD,
  PRODUCTS,
  INCOTERMS,
} from "@/lib/utils";
import { Tip, TIPS } from "@/components/ui/Tip";
import type { Order, Buyer } from "@/lib/supabase";

type OrderRow = Order & { buyers: { company: string; country: string } | null };

interface Props {
  order: OrderRow | null;       // null = new
  buyers: Buyer[];
  onClose: () => void;
  onSaved: (order: OrderRow) => void;
  defaultBuyerId?: string;      // pre-fill for lead conversion
  defaultProduct?: string;
}

const ORDER_STATUSES = [
  "confirmed", "in-production", "quality-check",
  "ready-to-ship", "shipped", "in-transit", "delivered", "cancelled",
] as const;

const PAYMENT_STATUSES = ["pending", "partial", "paid", "overdue"] as const;

const EMPTY = {
  order_number:      "",
  buyer_id:          "",
  product:           "",
  hs_code:           "",
  quantity_kg:       "",
  fob_price_usd:     "",
  incoterm:          "FOB",
  payment_terms:     "",
  payment_status:    "pending",
  status:            "confirmed",
  shipment_date:     "",
  estimated_arrival: "",
  destination_port:  "",
  tracking_number:   "",
  notes:             "",
};

export function OrderModal({ order, buyers, onClose, onSaved, defaultBuyerId, defaultProduct }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // populate form on open
  useEffect(() => {
    if (order) {
      setForm({
        order_number:      order.order_number,
        buyer_id:          order.buyer_id,
        product:           order.product,
        hs_code:           order.hs_code ?? "",
        quantity_kg:       String(order.quantity_kg),
        fob_price_usd:     String(order.fob_price_usd),
        incoterm:          order.incoterm ?? "FOB",
        payment_terms:     order.payment_terms ?? "",
        payment_status:    order.payment_status,
        status:            order.status,
        shipment_date:     order.shipment_date ?? "",
        estimated_arrival: order.estimated_arrival ?? "",
        destination_port:  order.destination_port ?? "",
        tracking_number:   order.tracking_number ?? "",
        notes:             order.notes ?? "",
      });
    } else {
      setForm({
        ...EMPTY,
        order_number: generateOrderNumber(),
        buyer_id:     defaultBuyerId ?? "",
        product:      defaultProduct ?? "",
      });
    }
    setError(null);
  }, [order, defaultBuyerId, defaultProduct]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const qty = parseFloat(form.quantity_kg) || 0;
  const fob = parseFloat(form.fob_price_usd) || 0;
  const estimatedTotal = qty * fob;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.buyer_id) { setError("Please select a buyer."); return; }
    if (!form.product)  { setError("Please select a product."); return; }
    if (qty <= 0)       { setError("Quantity must be greater than 0."); return; }
    if (fob <= 0)       { setError("FOB price must be greater than 0."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      order_number:      form.order_number,
      buyer_id:          form.buyer_id,
      product:           form.product,
      hs_code:           form.hs_code || null,
      quantity_kg:       qty,
      fob_price_usd:     fob,
      incoterm:          form.incoterm || null,
      payment_terms:     form.payment_terms || null,
      payment_status:    form.payment_status,
      status:            form.status,
      shipment_date:     form.shipment_date || null,
      estimated_arrival: form.estimated_arrival || null,
      destination_port:  form.destination_port || null,
      tracking_number:   form.tracking_number || null,
      notes:             form.notes || null,
    };

    try {
      if (order) {
        const { data, error: err } = await supabase
          .from("orders")
          .update(payload)
          .eq("id", order.id)
          .select("*, buyers(company, country)")
          .single();
        if (err) throw err;
        onSaved(data as OrderRow);
      } else {
        const { data, error: err } = await supabase
          .from("orders")
          .insert(payload)
          .select("*, buyers(company, country)")
          .single();
        if (err) throw err;
        onSaved(data as OrderRow);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {order ? `Edit Order — ${order.order_number}` : "New Order"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Row 1: order number + buyer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Order Number</label>
              <input className="input font-mono" value={form.order_number}
                onChange={(e) => set("order_number", e.target.value)} required />
            </div>
            <div>
              <label className="label">Buyer *</label>
              <select className="input" value={form.buyer_id}
                onChange={(e) => set("buyer_id", e.target.value)} required>
                <option value="">Select buyer…</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.company} ({b.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: product + HS code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product *</label>
              <select className="input" value={form.product}
                onChange={(e) => set("product", e.target.value)} required>
                <option value="">Select product…</option>
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">HS Code <Tip content={TIPS.HSCode} wide /></label>
              <input className="input font-mono" placeholder="e.g. 12099100"
                value={form.hs_code} onChange={(e) => set("hs_code", e.target.value)} />
            </div>
          </div>

          {/* Row 3: qty + fob + computed total */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Quantity (kg) *</label>
              <input className="input" type="number" min="0.01" step="0.01"
                placeholder="500" value={form.quantity_kg}
                onChange={(e) => set("quantity_kg", e.target.value)} required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">FOB Price / kg (USD) * <Tip content={TIPS.FOB} /></label>
              <input className="input" type="number" min="0.01" step="0.01"
                placeholder="3.50" value={form.fob_price_usd}
                onChange={(e) => set("fob_price_usd", e.target.value)} required />
            </div>
            <div>
              <label className="label">Estimated Total</label>
              <div className="input bg-gray-50 font-semibold text-emerald-700 cursor-default">
                {estimatedTotal > 0 ? formatUSD(estimatedTotal) : "—"}
              </div>
            </div>
          </div>

          {/* Row 4: incoterm + payment terms + payment status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label flex items-center gap-1.5">Incoterm <Tip content={TIPS.Incoterm} /></label>
              <select className="input" value={form.incoterm}
                onChange={(e) => set("incoterm", e.target.value)}>
                {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">Payment Terms <Tip content={TIPS.PaymentTerms} /></label>
              <input className="input" placeholder="e.g. 30% advance, 70% BL"
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)} />
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select className="input" value={form.payment_status}
                onChange={(e) => set("payment_status", e.target.value)}>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: order status + destination port */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Order Status</label>
              <select className="input" value={form.status}
                onChange={(e) => set("status", e.target.value)}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Destination Port</label>
              <input className="input" placeholder="e.g. Hamburg, DE"
                value={form.destination_port}
                onChange={(e) => set("destination_port", e.target.value)} />
            </div>
          </div>

          {/* Row 6: dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Shipment Date</label>
              <input className="input" type="date" value={form.shipment_date}
                onChange={(e) => set("shipment_date", e.target.value)} />
            </div>
            <div>
              <label className="label">Estimated Arrival</label>
              <input className="input" type="date" value={form.estimated_arrival}
                onChange={(e) => set("estimated_arrival", e.target.value)} />
            </div>
          </div>

          {/* Row 7: tracking */}
          <div>
            <label className="label">Tracking Number</label>
            <input className="input font-mono" placeholder="e.g. MSCU1234567"
              value={form.tracking_number}
              onChange={(e) => set("tracking_number", e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[72px] resize-y" placeholder="Additional notes…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : order ? "Save Changes" : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
