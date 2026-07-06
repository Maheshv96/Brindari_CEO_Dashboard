"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, ExternalLink, CheckCircle, AlertTriangle,
  Globe, Users, Building2, ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PRODUCTS, COUNTRIES, cn } from "@/lib/utils";

// ── Free lead sources ─────────────────────────────────────────────────────────
const SOURCES = [
  {
    name: "ImportYeti",
    url: "https://www.importyeti.com/search?q=moringa",
    desc: "Free US import records — find companies importing moringa powder/capsules from India",
    tag: "Free",
    tagColor: "bg-green-100 text-green-700",
    icon: Globe,
    tip: "Search 'moringa' → click any importer → copy their company name, address, and contact",
  },
  {
    name: "LinkedIn Sales",
    url: "https://www.linkedin.com/search/results/companies/?keywords=moringa%20importer",
    desc: "Search 'moringa importer' or 'health supplement distributor' in your target country",
    tag: "Free",
    tagColor: "bg-green-100 text-green-700",
    icon: Users,
    tip: "Filter by country → visit each company page → find the buyer/procurement contact",
  },
  {
    name: "Kompass",
    url: "https://www.kompass.com/searchCompanies?text=moringa",
    desc: "Global B2B directory with verified importer/distributor contacts by country",
    tag: "Free tier",
    tagColor: "bg-blue-100 text-blue-700",
    icon: Building2,
    tip: "Filter by HS code 12099100 (moringa seeds) or search product name",
  },
  {
    name: "Alibaba Buyers",
    url: "https://www.alibaba.com/trade/search?fsb=y&IndexArea=product_en&CatId=&SearchText=moringa+powder",
    desc: "Post a product and buyers who RFQ are warm leads — already looking for moringa",
    tag: "Free listing",
    tagColor: "bg-orange-100 text-orange-700",
    icon: Globe,
    tip: "Create a free supplier account → list Moringa Powder → respond to RFQs",
  },
  {
    name: "APEDA Buyer Database",
    url: "https://agriexchange.apeda.gov.in/product_profiles/proDetailed.aspx?productcode=0404",
    desc: "India's Agricultural Export Promotion Authority — official registered importers",
    tag: "Free",
    tagColor: "bg-green-100 text-green-700",
    icon: Globe,
    tip: "Government database of verified foreign buyers for Indian agri products",
  },
  {
    name: "Volza / TradeAtlas",
    url: "https://www.volza.com/p/moringa-powder/import/",
    desc: "Actual shipment records — see exactly who bought moringa and from whom",
    tag: "Free preview",
    tagColor: "bg-blue-100 text-blue-700",
    icon: Globe,
    tip: "Free preview shows company names. Sign up free for limited records per month",
  },
];

// ── CSV template ──────────────────────────────────────────────────────────────
const CSV_HEADERS = "company,contact_name,email,phone,country,product_interest,status,deal_value_usd,lead_score,source,notes";
const CSV_EXAMPLE = `GreenLife GmbH,Klaus Bauer,k.bauer@greenlife.de,+49301234567,Germany,Moringa Powder,new,45000,70,website,Found on ImportYeti
BioNature France,Sophie Dubois,s.dubois@bionature.fr,+33123456789,France,Moringa Capsules,new,28000,,linkedin,`;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LeadImportPage() {
  const db = createClient();
  const router   = useRouter();

  const [csv,      setCsv]      = useState("");
  const [parsed,   setParsed]   = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result,   setResult]   = useState<{ imported: number; errors: string[] } | null>(null);
  const [tab,      setTab]      = useState<"sources" | "csv" | "manual">("sources");

  // Manual entry
  const [manual, setManual] = useState({
    company: "", contact_name: "", email: "", phone: "",
    country: "", product_interest: "", source: "website",
    deal_value_usd: "", notes: "",
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // ── CSV parse ──────────────────────────────────────────────────────────────
  function parseCSV(text: string) {
    const lines  = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
  }

  function handleCSVChange(text: string) {
    setCsv(text);
    setParsed(parseCSV(text));
    setResult(null);
  }

  async function handleImport() {
    if (!parsed.length) return;
    setImporting(true);
    const errors: string[] = [];
    let imported = 0;

    for (const row of parsed) {
      if (!row.company?.trim()) { errors.push(`Row missing company: ${JSON.stringify(row)}`); continue; }
      const { error } = await db.from("leads").insert({
        company:          row.company,
        contact_name:     row.contact_name || row.company,
        email:            row.email || null,
        phone:            row.phone || null,
        country:          row.country || "Unknown",
        product_interest: row.product_interest || null,
        status:           (row.status as "new") || "new",
        deal_value_usd:   row.deal_value_usd ? Number(row.deal_value_usd) : null,
        lead_score:       row.lead_score ? Number(row.lead_score) : null,
        source:           row.source || "other",
        notes:            row.notes || null,
      });
      if (error) { errors.push(`${row.company}: ${error.message}`); } else { imported++; }
    }

    setResult({ imported, errors });
    setImporting(false);
  }

  async function handleManualSave() {
    if (!manual.company.trim() || !manual.country.trim()) return;
    setSaving(true);
    await db.from("leads").insert({
      company:          manual.company,
      contact_name:     manual.contact_name || manual.company,
      email:            manual.email || null,
      phone:            manual.phone || null,
      country:          manual.country,
      product_interest: manual.product_interest || null,
      status:           "new",
      deal_value_usd:   manual.deal_value_usd ? Number(manual.deal_value_usd) : null,
      source:           manual.source || "other",
      notes:            manual.notes || null,
    });
    setSaved(true);
    setManual({ company: "", contact_name: "", email: "", phone: "", country: "", product_interest: "", source: "website", deal_value_usd: "", notes: "" });
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_HEADERS + "\n" + CSV_EXAMPLE], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "brindari-leads-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/leads")}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Find organic leads from free sources, then import them in bulk</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["sources", "🌐 Free Lead Sources"],
          ["csv",     "📂 CSV Bulk Import"],
          ["manual",  "✏️ Add One by One"],
        ] as [typeof tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      {/* ── FREE SOURCES ────────────────────────────────────────────────────── */}
      {tab === "sources" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-800">
              <strong>Strategy:</strong> Visit each source below → copy company + contact details →
              use <strong>CSV Bulk Import</strong> tab or <strong>Add One by One</strong> to save them.
              Once imported, run an Email Campaign to reach all of them at once.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SOURCES.map(s => (
              <div key={s.name} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <s.icon className="h-4 w-4 text-gray-500 shrink-0" />
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  </div>
                  <span className={cn("badge shrink-0", s.tagColor)}>{s.tag}</span>
                </div>
                <p className="text-sm text-gray-600">{s.desc}</p>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  💡 {s.tip}
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary text-xs py-1.5 w-fit">
                  <ExternalLink className="h-3.5 w-3.5" /> Open {s.name} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CSV IMPORT ──────────────────────────────────────────────────────── */}
      {tab === "csv" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Paste CSV data or upload a file. Required column: <code className="bg-gray-100 px-1 rounded text-xs">company</code>
            </p>
            <button className="btn-secondary text-xs py-1.5" onClick={downloadTemplate}>
              <Upload className="h-3.5 w-3.5" /> Download Template
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-mono text-gray-400">
              {CSV_HEADERS}
            </div>
            <textarea
              className="w-full px-4 py-3 font-mono text-xs text-gray-700 outline-none resize-none"
              rows={8}
              placeholder={"Paste your CSV data here (without the header row)…\n\nExample:\nGreenLife GmbH,Klaus Bauer,k.bauer@greenlife.de,+4930123,Germany,Moringa Powder,new,45000,70,website,Found on ImportYeti"}
              value={csv}
              onChange={e => handleCSVChange(e.target.value)}
            />
          </div>

          {parsed.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-emerald-800">
                <strong>{parsed.length} leads</strong> ready to import
              </span>
              <button className="btn-primary py-1.5 text-sm" onClick={handleImport} disabled={importing}>
                {importing ? "Importing…" : `Import ${parsed.length} Leads`}
              </button>
            </div>
          )}

          {result && (
            <div className={cn("rounded-xl px-4 py-3 text-sm", result.errors.length ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200")}>
              <div className="flex items-center gap-2 font-medium mb-1">
                {result.errors.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                <span>{result.imported} leads imported successfully{result.errors.length ? `, ${result.errors.length} failed` : ""}</span>
              </div>
              {result.errors.map((e, i) => <p key={i} className="text-xs text-amber-700 pl-6">{e}</p>)}
              {result.imported > 0 && (
                <button className="mt-2 text-emerald-700 text-xs font-medium hover:underline pl-6" onClick={() => router.push("/leads")}>
                  View leads →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL ENTRY ────────────────────────────────────────────────────── */}
      {tab === "manual" && (
        <div className="space-y-4 max-w-xl">
          <p className="text-sm text-gray-500">Add leads one at a time as you find them from directories or LinkedIn.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company *</label>
              <input className="input" placeholder="GreenLife GmbH" value={manual.company}
                onChange={e => setManual(m => ({ ...m, company: e.target.value }))} />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" placeholder="Klaus Bauer" value={manual.contact_name}
                onChange={e => setManual(m => ({ ...m, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="k.bauer@greenlife.de" value={manual.email}
                onChange={e => setManual(m => ({ ...m, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+49 30 1234 5678" value={manual.phone}
                onChange={e => setManual(m => ({ ...m, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Country *</label>
              <select className="input" value={manual.country} onChange={e => setManual(m => ({ ...m, country: e.target.value }))}>
                <option value="">Select country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Product Interest</label>
              <select className="input" value={manual.product_interest} onChange={e => setManual(m => ({ ...m, product_interest: e.target.value }))}>
                <option value="">Select…</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={manual.source} onChange={e => setManual(m => ({ ...m, source: e.target.value }))}>
                {["website","linkedin","referral","importyeti","kompass","alibaba","cold_outreach","event","other"].map(s => (
                  <option key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Deal Value (USD)</label>
              <input className="input" type="number" placeholder="25000" value={manual.deal_value_usd}
                onChange={e => setManual(m => ({ ...m, deal_value_usd: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <input className="input" placeholder="Found on ImportYeti, imports 500kg/month from India"
                value={manual.notes} onChange={e => setManual(m => ({ ...m, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={handleManualSave}
              disabled={saving || !manual.company.trim() || !manual.country.trim()}>
              {saving ? "Saving…" : saved ? "✓ Saved!" : "Add Lead"}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-medium">Lead added to /leads</span>}
          </div>
        </div>
      )}
    </div>
  );
}
