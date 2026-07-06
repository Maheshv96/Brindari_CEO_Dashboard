"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink, CheckCircle, AlertTriangle, ArrowLeft,
  Upload, Star, Shield, Clock, Building2, Globe, Leaf,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PRODUCTS, cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/MultiSelect";

// ── Free supplier databases ───────────────────────────────────────────────────
const DATABASES = [
  {
    name: "IndiaMART",
    url: "https://www.indiamart.com/search.mp?ss=moringa+powder+exporter&priceFrom=&priceTo=&Unit=",
    tag: "Free",
    tagColor: "bg-green-100 text-green-700",
    icon: Globe,
    desc: "India's largest B2B marketplace — thousands of moringa processors and exporters",
    tip: "Filter by: ✓ 'Trust Seal' verified, ✓ Min 3 years in business. Check 'Response Rate' — good suppliers reply fast.",
    vetTips: ["Check 'Trust Seal' badge", "3+ years on platform", "High response rate", "GST verified"],
  },
  {
    name: "TradeIndia",
    url: "https://www.tradeindia.com/search.php?search=moringa+powder&CatId=&SubCatId=&language=en",
    tag: "Free",
    tagColor: "bg-green-100 text-green-700",
    icon: Leaf,
    desc: "Verified Indian exporters with export license and FSSAI certifications",
    tip: "Look for suppliers with 'Verified Exporter' badge. Check their export year and certificates on profile.",
    vetTips: ["Verified Exporter badge", "FSSAI certificate listed", "5+ years exporting", "ISO certification"],
  },
  {
    name: "APEDA Exporters",
    url: "https://apeda.gov.in/apedawebsite/Statutory_Reqmnt/REL.htm",
    tag: "Govt verified",
    tagColor: "bg-blue-100 text-blue-700",
    icon: Shield,
    desc: "Government of India's official list of registered agricultural exporters — most legitimate source",
    tip: "These are APEDA-registered exporters. Cross-check with FSSAI database for food safety compliance.",
    vetTips: ["Government registered", "APEDA membership number", "Annual renewal", "Audit compliant"],
  },
  {
    name: "Alibaba Suppliers",
    url: "https://www.alibaba.com/trade/search?fsb=y&IndexArea=company_en&CatId=&SearchText=moringa+powder+india",
    tag: "Verified badges",
    tagColor: "bg-orange-100 text-orange-700",
    icon: Building2,
    desc: "Filter by 'Gold Supplier' (5+ years) and 'Verified' — established Indian moringa processors",
    tip: "Use filters: Country=India, Min 5 Years Gold Supplier, Trade Assurance. Check their audit reports.",
    vetTips: ["Gold Supplier 5+ years", "On-site audit done", "Trade Assurance enabled", "Sample available"],
  },
  {
    name: "FSSAI License Search",
    url: "https://foscos.fssai.gov.in/",
    tag: "Mandatory check",
    tagColor: "bg-red-100 text-red-700",
    icon: Shield,
    desc: "Verify any supplier's FSSAI license before placing an order — it's the law for food export",
    tip: "Search the supplier's company name. Active license = legitimate food processor. Check expiry date.",
    vetTips: ["Active license status", "License not expired", "Correct address match", "Food category covers moringa"],
  },
  {
    name: "Spices Board India",
    url: "https://www.indianspices.com/market-intelligence/registered-exporters",
    tag: "Govt directory",
    tagColor: "bg-blue-100 text-blue-700",
    icon: Leaf,
    desc: "Ministry of Commerce registered moringa/herbal exporters — pre-verified by government",
    tip: "These exporters have passed government audits. Ideal for finding suppliers for EU/US markets.",
    vetTips: ["Spices Board registered", "Export license active", "Phytosanitary compliant", "EU/US market experience"],
  },
];

// ── Vetting checklist ─────────────────────────────────────────────────────────
const VETTING_CHECKS = [
  { icon: Clock,     label: "Years in business",       desc: "Minimum 5 years — shows stability and experience" },
  { icon: Shield,    label: "FSSAI license",            desc: "Mandatory for food export — verify on FOSCOS portal" },
  { icon: CheckCircle,label: "Organic certification",   desc: "NPOP (India) or NOP (USA) cert from accredited body" },
  { icon: Star,      label: "Export track record",      desc: "Ask for 3 recent buyer references or shipping bills" },
  { icon: Building2, label: "Own processing facility",  desc: "Own plant > contract processor — better quality control" },
  { icon: AlertTriangle,label: "GST & IEC registered",  desc: "Import Export Code (IEC) is mandatory to export legally" },
];

// ── CSV template ──────────────────────────────────────────────────────────────
const CSV_HEADERS = "company,contact_name,email,location,product,price_per_kg_inr,moq_kg,lead_time_days,certifications,payment_terms,rating,notes";
const CSV_EXAMPLE = `Green Farms TN,Ravi Kumar,ravi@greenfarms.in,"Coimbatore, Tamil Nadu",Moringa Powder,280,500,7,"FSSAI,Organic",50% advance,4.5,IndiaMART Gold supplier 5yr
Pure Leaf Exports,Suresh Nair,suresh@pureleaf.in,"Chennai, Tamil Nadu",Moringa Capsules,320,1000,5,"FSSAI,HACCP,Halal",30% advance,4.8,APEDA registered exporter`;

export default function SupplierFinderPage() {
  const db     = createClient();
  const router = useRouter();

  const [tab,    setTab]    = useState<"databases" | "checklist" | "import">("databases");
  const [csv,    setCsv]    = useState("");
  const [parsed, setParsed] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result,  setResult]  = useState<{ imported: number; errors: string[] } | null>(null);

  // Manual entry
  const [manual, setManual] = useState({
    company: "", contact_name: "", email: "", location: "", products: [] as string[],
    price_per_kg_inr: "", moq_kg: "", lead_time_days: "", certifications: "",
    payment_terms: "", rating: "4", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function parseCSV(text: string) {
    const lines   = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_HEADERS + "\n" + CSV_EXAMPLE], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "brindari-suppliers-template.csv" });
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!parsed.length) return;
    setImporting(true);
    const errors: string[] = []; let imported = 0;
    for (const row of parsed) {
      if (!row.company?.trim()) { errors.push(`Missing company: ${JSON.stringify(row)}`); continue; }
      const { error } = await db.from("suppliers").insert({
        company:          row.company,
        contact_name:     row.contact_name || row.company,
        email:            row.email || null,
        location:         row.location || null,
        product:          row.product || "Moringa Powder",
        price_per_kg_inr: row.price_per_kg_inr ? Number(row.price_per_kg_inr) : null,
        moq_kg:           row.moq_kg ? Number(row.moq_kg) : null,
        lead_time_days:   row.lead_time_days ? Number(row.lead_time_days) : null,
        certifications:   row.certifications ? row.certifications.split(",").map((c: string) => c.trim()) : null,
        payment_terms:    row.payment_terms || null,
        rating:           row.rating ? Number(row.rating) : null,
        is_active:        true,
      });
      if (error) errors.push(`${row.company}: ${error.message}`); else imported++;
    }
    setResult({ imported, errors }); setImporting(false);
  }

  async function handleManualSave() {
    if (!manual.company.trim()) return;
    setSaving(true);
    await db.from("suppliers").insert({
      company:          manual.company,
      contact_name:     manual.contact_name || manual.company,
      email:            manual.email || null,
      location:         manual.location || null,
      product:          manual.products.length ? manual.products.join(", ") : "Moringa Powder",
      price_per_kg_inr: manual.price_per_kg_inr ? Number(manual.price_per_kg_inr) : null,
      moq_kg:           manual.moq_kg ? Number(manual.moq_kg) : null,
      lead_time_days:   manual.lead_time_days ? Number(manual.lead_time_days) : null,
      certifications:   manual.certifications ? manual.certifications.split(",").map(c => c.trim()) : null,
      payment_terms:    manual.payment_terms || null,
      rating:           manual.rating ? Number(manual.rating) : null,
      is_active:        true,
      ...(manual.notes ? { notes: manual.notes } : {}),
    });
    setSaved(true);
    setManual({ company: "", contact_name: "", email: "", location: "", products: [], price_per_kg_inr: "", moq_kg: "", lead_time_days: "", certifications: "", payment_terms: "", rating: "4", notes: "" });
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/suppliers")}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find Legitimate Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Discover verified moringa processors with long-term presence — then add them to your supplier database</p>
        </div>
      </div>

      {/* Strategy banner */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 px-5 py-4 text-white">
        <p className="text-sm font-semibold mb-1">🌿 How to find the right supplier</p>
        <p className="text-xs text-emerald-200 leading-relaxed">
          Start with <strong className="text-white">APEDA</strong> or <strong className="text-white">Spices Board</strong> (government-verified) → cross-check their <strong className="text-white">FSSAI license</strong> on FOSCOS → request samples → run AI price comparison in <strong className="text-white">Suppliers → AI Compare</strong>.
          A supplier with 5+ years, own facility, FSSAI + Organic cert, and APEDA registration is your ideal partner.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["databases", "🔍 Supplier Databases"],
          ["checklist", "✅ How to Vet Them"],
          ["import",    "📂 Add to Dashboard"],
        ] as [typeof tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      {/* ── DATABASES ────────────────────────────────────────────────────────── */}
      {tab === "databases" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-800">
              <strong>Tip:</strong> Start with government sources (APEDA, Spices Board) — suppliers there are pre-audited.
              Use IndiaMART/TradeIndia to get contacts, then <strong>always verify FSSAI on FOSCOS</strong> before ordering.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DATABASES.map(db => (
              <div key={db.name} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <db.icon className="h-4 w-4 text-gray-500 shrink-0" />
                    <h3 className="font-semibold text-gray-900">{db.name}</h3>
                  </div>
                  <span className={cn("badge shrink-0", db.tagColor)}>{db.tag}</span>
                </div>
                <p className="text-sm text-gray-600">{db.desc}</p>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  💡 {db.tip}
                </div>
                {/* Vet checklist */}
                <div className="flex flex-wrap gap-1.5">
                  {db.vetTips.map(v => (
                    <span key={v} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700">
                      ✓ {v}
                    </span>
                  ))}
                </div>
                <a href={db.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1.5 w-fit">
                  <ExternalLink className="h-3.5 w-3.5" /> Open {db.name} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VETTING CHECKLIST ─────────────────────────────────────────────────── */}
      {tab === "checklist" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Before placing any order, verify these 6 things. A supplier who ticks all 6 is a long-term partner.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {VETTING_CHECKS.map((c, i) => (
              <div key={c.label} className="card p-4 flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm">
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <c.icon className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Red flags */}
          <div className="card p-5 border-red-100">
            <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Red flags — avoid these suppliers
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                "Refuses to show FSSAI license number",
                "No physical address or factory photos",
                "Price suspiciously low (below ₹200/kg)",
                "Asks for 100% advance payment upfront",
                "No sample available ('minimum 100kg sample')",
                "Brand new on platform (< 1 year)",
                "Can't provide COA (Certificate of Analysis)",
                "Pushes for WhatsApp-only communication",
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-red-700">
                  <span className="text-red-400">✕</span> {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT ───────────────────────────────────────────────────────────── */}
      {tab === "import" && (
        <div className="space-y-6">

          {/* CSV Import */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Bulk Import via CSV</h3>
              <button className="btn-secondary text-xs py-1.5" onClick={downloadTemplate}>
                <Upload className="h-3.5 w-3.5" /> Download Template
              </button>
            </div>
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-mono text-gray-400 truncate">
                {CSV_HEADERS}
              </div>
              <textarea className="w-full px-4 py-3 font-mono text-xs text-gray-700 outline-none resize-none" rows={5}
                placeholder={"Paste CSV data here (without header row)…"}
                value={csv}
                onChange={e => { setCsv(e.target.value); setParsed(parseCSV(e.target.value)); setResult(null); }} />
            </div>
            {parsed.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <span className="text-sm text-emerald-800"><strong>{parsed.length} suppliers</strong> ready to import</span>
                <button className="btn-primary py-1.5 text-sm" onClick={handleImport} disabled={importing}>
                  {importing ? "Importing…" : `Import ${parsed.length} Suppliers`}
                </button>
              </div>
            )}
            {result && (
              <div className={cn("rounded-xl px-4 py-3 text-sm border", result.errors.length ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")}>
                <p className="font-medium mb-1">{result.imported} suppliers imported{result.errors.length ? `, ${result.errors.length} failed` : " ✓"}</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-amber-700 pl-2">{e}</p>)}
                {result.imported > 0 && (
                  <button className="mt-2 text-emerald-700 text-xs font-medium hover:underline" onClick={() => router.push("/suppliers")}>
                    View suppliers →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Manual entry */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-t border-gray-100 pt-4">Add Supplier Manually</h3>
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
              <div className="col-span-2">
                <label className="label">Company *</label>
                <input className="input" placeholder="Green Farms Tamil Nadu" value={manual.company} onChange={e => setManual(m => ({ ...m, company: e.target.value }))} />
              </div>
              <div>
                <label className="label">Contact Name</label>
                <input className="input" placeholder="Ravi Kumar" value={manual.contact_name} onChange={e => setManual(m => ({ ...m, contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="ravi@greenfarms.in" value={manual.email} onChange={e => setManual(m => ({ ...m, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Location</label>
                <input className="input" placeholder="Coimbatore, Tamil Nadu" value={manual.location} onChange={e => setManual(m => ({ ...m, location: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Products Supplied</label>
                <MultiSelect
                  options={PRODUCTS}
                  value={manual.products}
                  onChange={v => setManual(m => ({ ...m, products: v }))}
                  placeholder="Select products…"
                />
              </div>
              <div>
                <label className="label">Price / kg (INR)</label>
                <input className="input" type="number" placeholder="280" value={manual.price_per_kg_inr} onChange={e => setManual(m => ({ ...m, price_per_kg_inr: e.target.value }))} />
              </div>
              <div>
                <label className="label">MOQ (kg)</label>
                <input className="input" type="number" placeholder="500" value={manual.moq_kg} onChange={e => setManual(m => ({ ...m, moq_kg: e.target.value }))} />
              </div>
              <div>
                <label className="label">Lead Time (days)</label>
                <input className="input" type="number" placeholder="7" value={manual.lead_time_days} onChange={e => setManual(m => ({ ...m, lead_time_days: e.target.value }))} />
              </div>
              <div>
                <label className="label">Rating</label>
                <select className="input" value={manual.rating} onChange={e => setManual(m => ({ ...m, rating: e.target.value }))}>
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} stars</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Certifications (comma-separated)</label>
                <input className="input" placeholder="FSSAI, Organic, ISO 22000" value={manual.certifications} onChange={e => setManual(m => ({ ...m, certifications: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes (where found, vetting status)</label>
                <input className="input" placeholder="Found on IndiaMART, FSSAI verified, sample received" value={manual.notes} onChange={e => setManual(m => ({ ...m, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={handleManualSave} disabled={saving || !manual.company.trim()}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Add Supplier"}
              </button>
              {saved && <span className="text-sm text-emerald-600 font-medium">Added to /suppliers</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
