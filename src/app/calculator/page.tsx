"use client";

import { useState } from "react";
import { Calculator, Save, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PRODUCTS, formatUSD, formatINR, cn } from "@/lib/utils";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { Tip, TIPS } from "@/components/ui/Tip";

const USD_TO_INR = parseFloat(process.env.NEXT_PUBLIC_USD_TO_INR ?? "83.5");

const SCENARIOS = [
  { label: "Break-even (0%)", premium: 0 },
  { label: "Conservative (10%)", premium: 0.10 },
  { label: "Target (20%)", premium: 0.20 },
  { label: "Premium (30%)", premium: 0.30 },
  { label: "Export premium (50%)", premium: 0.50 },
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ReadOnly({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", highlight ? "text-emerald-700 text-base" : "text-gray-900")}>{value}</span>
    </div>
  );
}

export default function CalculatorPage() {
  const supabase = createClient();

  // ── Inputs ───────────────────────────────────────────────────────────────────
  const [product,           setProduct]          = useState("");
  const [quantity,          setQuantity]         = useState("");
  const [country,           setCountry]          = useState("");
  const [exWorks,           setExWorks]          = useState("");
  const [inland,            setInland]           = useState("");
  const [exportCharges,     setExportCharges]    = useState("");
  const [portHandling,      setPortHandling]     = useState("");
  const [otherCosts,        setOtherCosts]       = useState("");
  const [targetMargin,      setTargetMargin]     = useState("20");
  const [sellingPrice,      setSellingPrice]     = useState("");
  const [notes,             setNotes]            = useState("");
  const [saving,            setSaving]           = useState(false);
  const [saved,             setSaved]            = useState(false);

  // ── Computed values ──────────────────────────────────────────────────────────
  const qty  = parseFloat(quantity)       || 0;
  const ew   = parseFloat(exWorks)        || 0;
  const inf  = parseFloat(inland)         || 0;
  const ec   = parseFloat(exportCharges)  || 0;
  const ph   = parseFloat(portHandling)   || 0;
  const oc   = parseFloat(otherCosts)     || 0;
  const sp   = parseFloat(sellingPrice)   || 0;
  const mg   = parseFloat(targetMargin)   || 20;

  const totalCostINR      = ew + inf + ec + ph + oc;
  const fobPerKgINR       = qty > 0 ? totalCostINR / qty : 0;
  const fobPerKgUSD       = fobPerKgINR / USD_TO_INR;
  const minSellingUSD     = mg > 0 ? fobPerKgUSD / (1 - mg / 100) : fobPerKgUSD;

  const revenueUSD        = sp * qty;
  const totalCostUSD      = totalCostINR / USD_TO_INR;
  const grossProfitUSD    = revenueUSD - totalCostUSD;
  const marginPct         = revenueUSD > 0 ? (grossProfitUSD / revenueUSD) * 100 : 0;

  const hasCosts = totalCostINR > 0;
  const hasPrice = sp > 0 && hasCosts;

  const marginColor = marginPct >= 20 ? "bg-green-500" : marginPct >= 10 ? "bg-amber-400" : "bg-red-500";
  const marginText  = marginPct >= 20
    ? "Healthy margin — profitable export."
    : marginPct >= 10
    ? "Thin margin — consider price increase or cost reduction."
    : "Below sustainable threshold — re-quote or renegotiate costs.";

  async function handleSave() {
    if (!hasCosts) { alert("Enter cost details first."); return; }
    setSaving(true);
    try {
      await supabase.from("fob_calculations").insert({
        product:             product || "Moringa",
        quantity_kg:         qty,
        ex_works_inr:        ew,
        inland_freight_inr:  inf,
        export_charges_inr:  ec,
        fob_inr:             totalCostINR,
        fob_usd:             fobPerKgUSD,
        margin_percent:      hasPrice ? marginPct : mg,
        destination_country: country || null,
        notes:               notes || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-emerald-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FOB Cost Calculator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Exchange rate: 1 USD = ₹{USD_TO_INR}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          <Panel title="Product & Quantity">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Product">
                <select className="input" value={product} onChange={e => setProduct(e.target.value)}>
                  <option value="">Select product…</option>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Quantity (kg)">
                <input className="input" type="number" min="0" placeholder="500" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="Destination Country">
                  <CountrySelect value={country} onChange={setCountry} allowAll={false} placeholder="Select country…" />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Cost Breakdown (INR)">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Ex-Works (production cost)", exWorks, setExWorks, TIPS.EXW],
                ["Inland Freight", inland, setInland, "Transport cost from farm/factory to the export port (truck/rail). Paid by the exporter under FOB terms."],
                ["Export Charges (CHA/customs)", exportCharges, setExportCharges, "Customs House Agent (CHA) fees, customs clearance, documentation charges. Required for all export shipments."],
                ["Port Handling / THC", portHandling, setPortHandling, "Terminal Handling Charge — port authority fee for loading the container onto the vessel. Typically ₹5,000–₹15,000 per container."],
                ["Other Costs", otherCosts, setOtherCosts, "Any additional costs: fumigation, testing lab fees, phytosanitary inspection, insurance to port, etc."],
              ].map(([label, val, setter, tip]) => (
                <div key={label as string}>
                  <label className="label flex items-center gap-1.5">
                    {label as string} <Tip content={tip as string} wide />
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                    <input className="input pl-6" type="number" min="0" step="0.01" placeholder="0"
                      value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} />
                  </div>
                </div>
              ))}
              <div className="col-span-2 rounded-lg bg-gray-50 px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">Total Cost</span>
                <span className="text-sm font-bold text-gray-900">{formatINR(totalCostINR)}</span>
              </div>
            </div>
          </Panel>

          <Panel title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1.5">
                  Target Margin (%)
                  <Tip content="Gross margin percentage you want to earn above your total FOB cost. 20%+ is considered healthy for export. Below 10% is risky." />
                </label>
                <input className="input" type="number" min="0" max="100" step="0.1" placeholder="20"
                  value={targetMargin} onChange={e => setTargetMargin(e.target.value)} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  Your Quoted Price (USD/kg)
                  <Tip content={TIPS.FOB} />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input className="input pl-6" type="number" min="0" step="0.01" placeholder="3.50"
                    value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
                </div>
              </div>
            </div>
          </Panel>

          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[80px] resize-y" placeholder="Quote reference, buyer, special requirements…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button className="btn-primary w-full" onClick={handleSave} disabled={saving || !hasCosts}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
             : saved ? "✓ Saved!"
             : <><Save className="h-4 w-4" /> Save Calculation</>}
          </button>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          <Panel title="FOB Cost Analysis">
            {!hasCosts ? (
              <p className="text-sm text-gray-400 py-4 text-center">Enter cost breakdown to see analysis</p>
            ) : (
              <>
                <ReadOnly label="Total Cost (INR)"           value={formatINR(totalCostINR)} />
                <ReadOnly label={`FOB Cost/kg (INR) — ${qty > 0 ? qty.toLocaleString() + " kg" : "enter qty"}`}
                          value={fobPerKgINR > 0 ? formatINR(fobPerKgINR) : "—"} />
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    FOB Cost/kg (USD) <Tip content={TIPS.FOBCalc} wide />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900">
                    {fobPerKgUSD > 0 ? `$${fobPerKgUSD.toFixed(4)}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-500">{`Min. Selling at ${mg}% margin`}</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-700 text-base">
                    {minSellingUSD > 0 ? `$${minSellingUSD.toFixed(4)}/kg` : "—"}
                  </span>
                </div>
              </>
            )}
          </Panel>

          {hasPrice && (
            <Panel title={`At Your Price — $${sp}/kg`}>
              <ReadOnly label="Total Revenue"       value={formatUSD(revenueUSD)} />
              <ReadOnly label="Total Cost (USD)"    value={formatUSD(totalCostUSD)} />
              <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-500">Gross Profit</span>
                <div className="flex items-center gap-1.5">
                  {grossProfitUSD >= 0
                    ? <TrendingUp className="h-4 w-4 text-green-600" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span className={cn("text-sm font-semibold tabular-nums", grossProfitUSD >= 0 ? "text-green-700" : "text-red-600")}>
                    {formatUSD(grossProfitUSD)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-500">Margin %</span>
                <span className={cn("text-sm font-bold", marginPct >= 20 ? "text-green-700" : marginPct >= 10 ? "text-amber-600" : "text-red-600")}>
                  {marginPct.toFixed(1)}%
                </span>
              </div>

              {/* Health bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", marginColor)}
                    style={{ width: `${Math.min(Math.max(marginPct, 0), 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{marginText}</p>
              </div>
            </Panel>
          )}

          <Panel title="Price Scenarios">
            {!hasCosts || fobPerKgUSD === 0 ? (
              <p className="text-sm text-gray-400 py-2 text-center">Enter costs and quantity to see scenarios</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left text-xs font-semibold text-gray-500">Scenario</th>
                    <th className="pb-2 text-right text-xs font-semibold text-gray-500">Price/kg</th>
                    <th className="pb-2 text-right text-xs font-semibold text-gray-500">Margin</th>
                    <th className="pb-2 text-right text-xs font-semibold text-gray-500">Profit (shipment)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {SCENARIOS.map(({ label, premium }) => {
                    const price  = fobPerKgUSD * (1 + premium);
                    const rev    = price * qty;
                    const profit = rev - totalCostUSD;
                    const marg   = rev > 0 ? (profit / rev) * 100 : 0;
                    const isActive = sp > 0 && Math.abs(price - sp) < 0.001;
                    return (
                      <tr key={label} className={cn("transition-colors", isActive && "bg-emerald-50")}>
                        <td className="py-2 text-xs text-gray-600">{label}</td>
                        <td className="py-2 text-right text-xs font-mono text-gray-900">${price.toFixed(4)}</td>
                        <td className={cn("py-2 text-right text-xs font-medium", marg >= 20 ? "text-green-700" : marg >= 10 ? "text-amber-600" : "text-red-600")}>
                          {marg.toFixed(1)}%
                        </td>
                        <td className="py-2 text-right text-xs font-medium text-gray-700">{formatUSD(profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
