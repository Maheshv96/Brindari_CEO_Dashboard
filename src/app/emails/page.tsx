"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Sparkles, Send, Brain, RefreshCw,
  Users, Mail, TrendingUp, Loader2, ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PRODUCTS, COUNTRIES, STATUS_COLORS, cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Tip, TIPS } from "@/components/ui/Tip";
import type { EmailCampaign, Lead } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
const STEPS = [
  { value: 1, emoji: "🎯", label: "Cold Outreach" },
  { value: 2, emoji: "📋", label: "Detailed Inquiry" },
  { value: 3, emoji: "🧪", label: "Sample Follow-up" },
  { value: 4, emoji: "💬", label: "Direct Ask" },
  { value: 5, emoji: "🔄", label: "Retention" },
];

// ── New Campaign modal ─────────────────────────────────────────────────────────
function CampaignModal({ leads, onClose, onCreated }: {
  leads: Lead[];
  onClose: () => void;
  onCreated: (c: EmailCampaign) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({ name: "", products: [] as string[], target_country: "", sequence_step: 1 });
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const matchingLeads = leads.filter(l => {
    if (!l.email) return false;
    if (form.target_country && form.target_country !== "all" && l.country !== form.target_country) return false;
    if (form.products.length > 0 && l.product_interest) {
      const leadProds = l.product_interest.split(", ").filter(Boolean);
      if (!form.products.some(p => leadProds.includes(p))) return false;
    }
    return true;
  });

  async function handleCreate(launch: boolean) {
    if (!form.name.trim())    { setErr("Campaign name required."); return; }
    if (!form.products.length) { setErr("Select at least one product."); return; }
    setSaving(true); setErr(null);

    try {
      const { data: camp, error } = await supabase.from("email_campaigns").insert({
        name:           form.name,
        product:        form.products.join(", "),
        target_country: form.target_country || null,
        status:         "draft",
        total_leads:    matchingLeads.length,
      }).select().single();
      if (error) throw error;

      onCreated(camp as EmailCampaign);

      if (launch && matchingLeads.length > 0) {
        setLaunching(true);
        const res = await fetch("/api/email-agent/bulk-campaign", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            campaignId:    camp.id,
            leads:         matchingLeads,
            product:       form.products.join(", "),
            sequenceStep:  form.sequence_step,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert(`✓ Campaign launched! ${data.sent} emails sent, ${data.queued} queued.`);
      }
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false); setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">New Campaign</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}

          <div>
            <label className="label">Campaign Name</label>
            <input className="input" placeholder="Germany Moringa Powder Outreach Q2" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Products</label>
              <MultiSelect
                options={PRODUCTS}
                value={form.products}
                onChange={v => setForm(f => ({ ...f, products: v }))}
                placeholder="All products…"
              />
            </div>
            <div>
              <label className="label">Target Country</label>
              <select className="input" value={form.target_country} onChange={e => set("target_country", e.target.value)}>
                <option value="all">All countries</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Sequence Step</label>
            <select className="input" value={form.sequence_step} onChange={e => set("sequence_step", Number(e.target.value))}>
              {STEPS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Lead count */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
            <p className="text-sm text-emerald-800">
              <span className="font-bold text-lg text-emerald-700">{matchingLeads.length}</span>
              {" "}leads match this campaign
              {matchingLeads.length === 0 && <span className="text-orange-600"> — no leads with email addresses match these filters</span>}
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-secondary" onClick={() => handleCreate(false)} disabled={saving}>
              {saving && !launching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Draft
            </button>
            <button type="button" className="btn-primary" onClick={() => handleCreate(true)} disabled={saving || matchingLeads.length === 0}>
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Launch Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Campaign card ──────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onClassify }: {
  campaign: EmailCampaign;
  onClassify: (id: string) => Promise<void>;
}) {
  const supabase = createClient();
  const router   = useRouter();
  const [classifying, setClassifying] = useState(false);
  const [result,      setResult]      = useState<{ classified: number; breakdown: Record<string, number> } | null>(null);
  const [sentLogs,    setSentLogs]    = useState<{ email_to: string; subject: string; sent_at: string | null; sequence_step: number }[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function handleClassify() {
    setClassifying(true);
    await onClassify(campaign.id);
    setClassifying(false);
    setResult(null);
  }

  async function handleSentClick() {
    if (sentLogs) { setSentLogs(null); return; } // toggle off
    setLoadingLogs(true);
    const { data } = await supabase
      .from("email_logs")
      .select("email_to, subject, sent_at, sequence_step")
      .eq("campaign_id", campaign.id)
      .order("sent_at", { ascending: false });
    setSentLogs((data ?? []) as { email_to: string; subject: string; sent_at: string | null; sequence_step: number }[]);
    setLoadingLogs(false);
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {campaign.product
              ? campaign.product.split(", ").filter(Boolean).map(p => (
                  <span key={p} className="rounded-full bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{p}</span>
                ))
              : <span className="text-xs text-gray-400">All products</span>}
            <span className="text-xs text-gray-400">· {campaign.target_country || "All countries"}</span>
          </div>
        </div>
        <span className={cn("badge shrink-0", STATUS_COLORS[campaign.status] ?? "bg-gray-100 text-gray-600")}>
          {campaign.status}
        </span>
      </div>

      {/* Stats — all clickable */}
      <div className="grid grid-cols-3 gap-2">
        {/* Sent — opens email log */}
        <button
          onClick={handleSentClick}
          className={cn(
            "rounded-lg px-2 py-2 text-center transition-colors hover:bg-emerald-50 hover:ring-1 hover:ring-emerald-200",
            sentLogs ? "bg-emerald-50 ring-1 ring-emerald-300" : "bg-gray-50"
          )}
        >
          {loadingLogs
            ? <Loader2 className="mx-auto h-3.5 w-3.5 text-gray-400 mb-1 animate-spin" />
            : <Send className="mx-auto h-3.5 w-3.5 text-gray-400 mb-1" />}
          <p className="text-sm font-bold text-gray-900">{campaign.emails_sent ?? 0}</p>
          <p className="text-xs text-emerald-600 font-medium">Sent ↗</p>
        </button>

        {/* Replies — links to contacted leads */}
        <button
          onClick={() => router.push("/leads?status=contacted")}
          className="rounded-lg bg-gray-50 px-2 py-2 text-center hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-colors"
        >
          <Mail className="mx-auto h-3.5 w-3.5 text-gray-400 mb-1" />
          <p className="text-sm font-bold text-gray-900">{campaign.replies_received ?? 0}</p>
          <p className="text-xs text-blue-600 font-medium">Replies ↗</p>
        </button>

        {/* Interested — links to qualified leads */}
        <button
          onClick={() => router.push("/leads?status=qualified")}
          className="rounded-lg bg-gray-50 px-2 py-2 text-center hover:bg-amber-50 hover:ring-1 hover:ring-amber-200 transition-colors"
        >
          <TrendingUp className="mx-auto h-3.5 w-3.5 text-gray-400 mb-1" />
          <p className="text-sm font-bold text-gray-900">{campaign.interested_count ?? 0}</p>
          <p className="text-xs text-amber-600 font-medium">Interested ↗</p>
        </button>
      </div>

      {/* Sent log panel */}
      {sentLogs && (
        <div className="rounded-lg border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Emails sent ({sentLogs.length})</span>
            <button onClick={() => setSentLogs(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          {sentLogs.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-3">No emails logged yet.</p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {sentLogs.map((log, i) => (
                <li key={i} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-700 truncate">{log.email_to}</span>
                    <span className="text-gray-400 shrink-0">Step {log.sequence_step}</span>
                  </div>
                  <p className="text-gray-400 truncate mt-0.5">{log.subject}</p>
                  <p className="text-gray-300 mt-0.5">
                    {log.sent_at ? new Date(log.sent_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : "queued"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Classify button */}
      <button
        onClick={handleClassify}
        disabled={classifying}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
      >
        {classifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
        Classify Replies with AI
      </button>

      {result && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Classified {result.classified} · 🟢 {result.breakdown.interested} interested · 🟡 {result.breakdown.needs_info} needs info · 🔴 {result.breakdown.not_interested} not interested
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EmailsPage() {
  const supabase     = createClient();

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Quick generator state
  const [gen, setGen] = useState({
    products:          [] as string[],  // multi-select products
    countries:         [] as string[],  // multi-select target countries
    step:              1,
    company:           "",
    contact:           "",
    tone:              "professional",
    certifications:    [] as string[],
    fob_price:         "",
    moq:               "",
    sample:            true,
    packaging:         "",
    lead_time:         "",
    payment_terms:     "",
    shelf_life:        "",
    hs_code:           "",
    container_loading: "",
    port:              "",
    show_docs:         false,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previews, setPreviews]   = useState<{ country: string; email: string }[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const preview = previews[activeIdx]?.email ?? null;
  const [provider, setProvider] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sendTo,    setSendTo]   = useState("");
  const [sending,   setSending]  = useState(false);
  const [sentOk,    setSentOk]   = useState(false);

  const setG = (k: string, v: string | number) => setGen(g => ({ ...g, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: camps }, { data: leadsData }] = await Promise.all([
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("*").in("status", ["new", "contacted", "qualified", "negotiating"]),
    ]);
    setCampaigns((camps ?? []) as EmailCampaign[]);
    setLeads((leadsData ?? []) as Lead[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("action") === "new") setModalOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    if (!gen.products.length || !gen.company) { alert("Select at least one product and enter company name."); return; }
    setGenerating(true); setPreviews([]); setActiveIdx(0);
    const targets = gen.countries.length > 0 ? gen.countries : [""];
    try {
      const results: { country: string; email: string }[] = [];
      let lastProvider: string | null = null;
      for (const country of targets) {
        const res = await fetch("/api/email-agent/generate", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            product:           gen.products.join(", "),
            target_country:    country,
            company:           gen.company,
            contact_name:      gen.contact,
            sequence_step:     gen.step,
            tone:              gen.tone,
            certifications:    gen.certifications,
            fob_price:         gen.fob_price,
            moq:               gen.moq,
            sample:            gen.sample ? "yes" : "no",
            packaging:         gen.packaging,
            lead_time:         gen.lead_time,
            payment_terms:     gen.payment_terms,
            shelf_life:        gen.shelf_life,
            hs_code:           gen.hs_code,
            container_loading: gen.container_loading,
            port:              gen.port,
            show_docs:         gen.show_docs,
          }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        results.push({ country: country || "Global", email: data.email });
        lastProvider = data.provider ?? null;
      }
      setPreviews(results);
      setProvider(lastProvider);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendTest() {
    if (!sendTo.includes("@")) { alert("Enter a valid email address."); return; }
    if (!preview) return;
    setSending(true); setSentOk(false);
    try {
      const res = await fetch("/api/email-agent/send-test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          to:        sendTo,
          emailText: preview,
          company:   gen.company,
          product:   gen.products.join(", "),
          details: {
            product:           gen.products.join(", "),
            fob_price:         gen.fob_price,
            moq:               gen.moq,
            certifications:    gen.certifications,
            sample:            gen.sample,
            packaging:         gen.packaging,
            lead_time:         gen.lead_time,
            payment_terms:     gen.payment_terms,
            shelf_life:        gen.shelf_life,
            hs_code:           gen.hs_code,
            container_loading: gen.container_loading,
            port:              gen.port,
            show_docs:         gen.show_docs,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert("Send failed: " + data.error); return; }
      setSentOk(true);
      setTimeout(() => setSentOk(false), 5000);
    } finally {
      setSending(false);
    }
  }

  async function handleClassify(campaignId: string) {
    const res  = await fetch("/api/email-agent/classify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ campaignId }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    // Refresh campaigns to update interested_count
    load();
    return data;
  }

  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="mt-0.5 text-sm text-gray-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            AI-powered outreach · Groq Llama 3.1 (FREE) · Resend delivery
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {/* Live configuration status */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: "✅",
            label: "Groq AI",
            value: "llama-3.1-8b-instant",
            sub: "FREE · 14,400 req/day",
            color: "bg-green-50 border-green-200 text-green-800",
          },
          {
            icon: "✅",
            label: "Resend",
            value: "re_UVPtsyo4…",
            sub: "3,000 emails/month free",
            color: "bg-green-50 border-green-200 text-green-800",
          },
          {
            icon: "✅",
            label: "Domain",
            value: "brindari.com",
            sub: "Sending from hello@brindari.com",
            color: "bg-green-50 border-green-200 text-green-800",
          },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base">{s.icon}</span>
              <span className="text-xs font-bold uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-sm font-semibold">{s.value}</p>
            <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Agent flow banner */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-emerald-200" />
          <span className="text-sm font-semibold">How the AI agent works — step by step</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-3">
          {[
            { step: "1", icon: "📋", title: "You set up a campaign", desc: "Pick product + target country. The system finds matching leads automatically." },
            { step: "2", icon: "✍️", title: "Groq Llama 3.1 writes emails", desc: "Each email is personalised to the company name, country market context, and sequence step. Completely free." },
            { step: "3", icon: "📨", title: "Resend delivers them", desc: "Emails go from outreach@brindari.com. Replies come to your inbox." },
          ].map(s => (
            <div key={s.step} className="rounded-lg bg-white/10 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-white/20 rounded-full w-5 h-5 flex items-center justify-center font-bold">{s.step}</span>
                <span className="text-sm">{s.icon} {s.title}</span>
              </div>
              <p className="text-xs text-emerald-200 pl-7">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-100 flex-wrap border-t border-white/20 pt-2">
          {[
            "📬 Replies land in your inbox",
            "→", "🧠 Click 'Classify Replies' — AI labels each reply",
            "→", "⬆️ Lead scores auto-updated (+30 interested, -20 not interested)",
            "→", "✅ Interested leads auto-promoted to 'Qualified'",
          ].map((s, i) => (
            <span key={i} className={s === "→" ? "text-emerald-400 font-bold" : ""}>{s}</span>
          ))}
        </div>
      </div>

      {/* ── Quick Email Generator ──────────────────────────────────────────── */}
      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Quick Email Generator</h2>
          <span className="text-xs text-gray-400">— AI writes a personalised outreach email in seconds</span>
        </div>

        {/* Section A — Who are you writing to? */}
        <div className="border-t border-gray-100 pt-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Who are you writing to?</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-3">
            <div>
              <label className="label">Company Name *</label>
              <input className="input" placeholder="Acme Health GmbH" value={gen.company}
                onChange={e => setG("company", e.target.value)} />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" placeholder="Maria Schmidt" value={gen.contact}
                onChange={e => setG("contact", e.target.value)} />
            </div>
            <div>
              <label className="label">Target Countries</label>
              <MultiSelect
                options={COUNTRIES}
                value={gen.countries}
                onChange={v => setG("countries", v as unknown as string)}
                placeholder="Select countries…"
              />
            </div>
          </div>
        </div>

        {/* Section B — What are you offering? */}
        <div className="border-t border-gray-100 pt-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">What are you offering?</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-3">
            <div>
              <label className="label">Products *</label>
              <MultiSelect
                options={PRODUCTS}
                value={gen.products}
                onChange={v => setG("products", v as unknown as string)}
                placeholder="Select products…"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                FOB Price / kg (USD) <Tip content={TIPS.FOB} />
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input className="input pl-6" type="number" step="0.01" placeholder="3.50"
                  value={gen.fob_price} onChange={e => setG("fob_price", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                MOQ (kg) <Tip content={TIPS.MOQ} />
              </label>
              <input className="input" type="number" placeholder="500 kg minimum"
                value={gen.moq} onChange={e => setG("moq", e.target.value)} />
            </div>
          </div>

          {/* Certifications */}
          <div className="mt-4">
            <label className="label flex items-center gap-1.5">
              Certifications to highlight <Tip content={TIPS.FSSAI} wide />
            </label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {["HACCP","FSSAI","APEDA","NABL","Organic","ISO 22000","Halal","Kosher","Non-GMO"].map(cert => (
                <button key={cert} type="button"
                  onClick={() => {
                    const certs = gen.certifications;
                    const next  = certs.includes(cert) ? certs.filter(c => c !== cert) : [...certs, cert];
                    setG("certifications", next as unknown as string);
                  }}
                  className={cn("rounded-md px-3.5 py-1.5 text-xs font-medium border transition-colors",
                    gen.certifications.includes(cert)
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-500")}>
                  {cert}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section C — How should it be written? */}
        <div className="border-t border-gray-100 pt-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">How should it be written?</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-3">

            {/* Sequence step — horizontal pills */}
            <div className="col-span-2">
              <label className="label">Outreach Stage</label>
              <div className="grid grid-cols-5 gap-1.5 mt-1">
                {STEPS.map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setG("step", s.value)}
                    className={cn(
                      "rounded-lg px-2 py-2.5 text-center text-xs font-medium transition-all",
                      gen.step === s.value
                        ? "bg-[#0F6E56] text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    )}>
                    <span className="block text-base mb-0.5">{s.emoji}</span>
                    <span className="leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone + Sample in one column */}
            <div className="space-y-3">
              <div>
                <label className="label">Writing Tone</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { v: "professional", label: "Professional", emoji: "💼" },
                    { v: "friendly",     label: "Friendly",     emoji: "🤝" },
                    { v: "direct",       label: "Direct",       emoji: "⚡" },
                    { v: "urgent",       label: "Urgent",       emoji: "🔥" },
                  ].map(t => (
                    <button key={t.v} type="button"
                      onClick={() => setG("tone", t.v)}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-xs font-medium transition-all text-center",
                        gen.tone === t.v
                          ? "bg-[#0F6E56] text-white"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      )}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Offer Free Sample?</label>
                <button type="button"
                  onClick={() => setG("sample", !gen.sample as unknown as string)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left flex items-center gap-2",
                    gen.sample
                      ? "border-[#0F6E56] bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-500"
                  )}>
                  <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    gen.sample ? "border-[#0F6E56] bg-[#0F6E56]" : "border-gray-300")}>
                    {gen.sample && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  {gen.sample ? "Yes — include sample offer" : "No sample this time"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Details */}
        <div className="border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors group"
          >
            <span className={`transition-transform duration-200 ${showAdvanced ? "rotate-90" : ""}`}>▶</span>
            Advanced Details
            <span className="text-gray-400 font-normal">— packaging, lead time, HS code, payment terms</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Packaging Options</label>
                <input className="input" placeholder="e.g. 25kg bulk bags, retail pouches"
                  value={gen.packaging} onChange={e => setG("packaging", e.target.value)} />
              </div>
              <div>
                <label className="label">Lead Time</label>
                <input className="input" placeholder="e.g. 2–3 weeks production + shipping"
                  value={gen.lead_time} onChange={e => setG("lead_time", e.target.value)} />
              </div>
              <div>
                <label className="label">Payment Terms</label>
                <input className="input" placeholder="e.g. 30% advance, 70% before shipment"
                  value={gen.payment_terms} onChange={e => setG("payment_terms", e.target.value)} />
              </div>
              <div>
                <label className="label">Shelf Life</label>
                <input className="input" placeholder="e.g. 24 months in cool dry storage"
                  value={gen.shelf_life} onChange={e => setG("shelf_life", e.target.value)} />
              </div>
              <div>
                <label className="label">HS Code</label>
                <input className="input" placeholder="e.g. 07123010"
                  value={gen.hs_code} onChange={e => setG("hs_code", e.target.value)} />
              </div>
              <div>
                <label className="label">Container Loading</label>
                <input className="input" placeholder="e.g. 14,000kg / 20ft, 28,000kg / 40ft"
                  value={gen.container_loading} onChange={e => setG("container_loading", e.target.value)} />
              </div>
              <div>
                <label className="label">Port of Loading</label>
                <input className="input" placeholder="e.g. Mumbai/JNPT"
                  value={gen.port} onChange={e => setG("port", e.target.value)} />
              </div>
              <div className="flex items-end">
                <button type="button"
                  onClick={() => setG("show_docs", !gen.show_docs as unknown as string)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left flex items-center gap-2",
                    gen.show_docs
                      ? "border-[#0F6E56] bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-500"
                  )}>
                  <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    gen.show_docs ? "border-[#0F6E56] bg-[#0F6E56]" : "border-gray-300")}>
                    {gen.show_docs && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  Include Documentation List
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          className="w-full py-3 rounded-xl bg-[#0F6E56] text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#0A5040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating personalised email…</>
            : <><Sparkles className="h-4 w-4" /> Generate Email</>}
        </button>

        {/* Preview */}
        {previews.length > 0 && (
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Generated Email</span>
                {provider && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">✓ {provider}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard?.writeText(preview ?? "")}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium">Copy</button>
                <button onClick={() => { setPreviews([]); setActiveIdx(0); setProvider(null); setSentOk(false); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>

            {/* Country tabs — shown only when multiple countries were generated */}
            {previews.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {previews.map((p, i) => (
                  <button
                    key={p.country}
                    onClick={() => { setActiveIdx(i); setSentOk(false); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      i === activeIdx
                        ? "bg-emerald-700 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-400"
                    }`}
                  >
                    {p.country}
                  </button>
                ))}
              </div>
            )}

            {/* Email body */}
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed border-b border-gray-100 pb-5 mb-1">{preview}</pre>

            {/* Send to inbox */}
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs font-semibold text-emerald-800 mb-2">📬 Send this email to an inbox</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  className="input flex-1 text-sm py-1.5"
                  placeholder="recipient@email.com"
                  value={sendTo}
                  onChange={e => { setSendTo(e.target.value); setSentOk(false); }}
                />
                <button
                  onClick={handleSendTest}
                  disabled={sending || !sendTo}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors shrink-0"
                >
                  {sending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                    : sentOk
                    ? <>✅ Sent!</>
                    : <><Send className="h-3.5 w-3.5" /> Send Email</>}
                </button>
              </div>
              {sentOk && (
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  ✓ Email delivered via Resend · Check your inbox (including spam/promotions)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Campaign cards ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Campaigns <span className="text-gray-400 font-normal">({campaigns.length})</span>
          </h2>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="card h-48 animate-pulse bg-gray-100" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <Mail className="mx-auto h-8 w-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No campaigns yet.</p>
            <button
              className="mt-3 text-sm text-emerald-700 hover:underline font-medium"
              onClick={() => setModalOpen(true)}
            >
              Create your first campaign →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} onClassify={handleClassify} />
            ))}
          </div>
        )}
      </div>

      {/* Lead pool info */}
      {!loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Users className="h-3.5 w-3.5" />
          <span>{leads.length} active leads (new / contacted / qualified / negotiating) available for campaigns</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      )}

      {modalOpen && (
        <CampaignModal
          leads={leads}
          onClose={() => setModalOpen(false)}
          onCreated={c => setCampaigns(prev => [c, ...prev])}
        />
      )}
    </div>
  );
}
