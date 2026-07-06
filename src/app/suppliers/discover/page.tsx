"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, XCircle, Loader2, RefreshCw,
  Zap, Star, MapPin, Shield,
  Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoveredSupplier } from "@/lib/supabase";

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function scoreLabel(score: number) {
  if (score >= 80) return "High";
  if (score >= 60) return "Med";
  return "Low";
}

function statusClass(status: DiscoveredSupplier["status"]) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "rejected") return "bg-red-100 text-red-700 border-red-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function sourceColor(source: string | null) {
  if (source === "APEDA")      return "bg-blue-100 text-blue-700 border-blue-200";
  if (source === "IndiaMART")  return "bg-orange-100 text-orange-700 border-orange-200";
  if (source === "TradeIndia") return "bg-purple-100 text-purple-700 border-purple-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

// ── Reject modal ───────────────────────────────────────────────────────────────

function RejectModal({
  supplier, onClose, onConfirm,
}: {
  supplier: DiscoveredSupplier;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Reject Supplier</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting <strong>{supplier.company_name}</strong>. Add a reason (optional).
          </p>
          <div>
            <label className="label">Reason</label>
            <input
              className="input"
              placeholder="e.g. No FSSAI license, unverified contact…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onConfirm(reason)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => onConfirm(reason)}
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Expanded detail row ────────────────────────────────────────────────────────

function DetailRow({ supplier }: { supplier: DiscoveredSupplier }) {
  return (
    <tr className="bg-emerald-50/40 border-b border-emerald-100">
      <td colSpan={9} className="px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-4">
          {supplier.contact_person && (
            <div><span className="font-medium text-gray-500">Contact: </span>{supplier.contact_person}</div>
          )}
          {supplier.email && (
            <div>
              <span className="font-medium text-gray-500">Email: </span>
              <a href={`mailto:${supplier.email}`} className="text-emerald-700 hover:underline">{supplier.email}</a>
            </div>
          )}
          {supplier.phone && (
            <div>
              <span className="font-medium text-gray-500">Phone: </span>
              <a href={`tel:${supplier.phone}`} className="text-emerald-700 hover:underline">{supplier.phone}</a>
            </div>
          )}
          {supplier.location && (
            <div><span className="font-medium text-gray-500">Location: </span>{supplier.location}</div>
          )}
          {supplier.certifications?.length ? (
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Certifications: </span>
              {supplier.certifications.join(", ")}
            </div>
          ) : null}
          {supplier.rejection_reason && (
            <div className="col-span-2">
              <span className="font-medium text-red-500">Rejection reason: </span>
              <span className="text-red-700">{supplier.rejection_reason}</span>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Supplier table row ─────────────────────────────────────────────────────────

function SupplierRow({
  supplier, onApprove, onReject, approving,
}: {
  supplier: DiscoveredSupplier;
  onApprove: (id: string) => void;
  onReject:  (s: DiscoveredSupplier) => void;
  approving: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isApproving = approving === supplier.id;

  return (
    <>
      <tr className={cn(
        "border-b border-gray-100 transition-colors hover:bg-gray-50",
        expanded && "bg-gray-50"
      )}>
        {/* Score */}
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <div className="flex flex-col items-center gap-0.5">
            <span className={cn(
              "inline-block rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums",
              scoreBadgeClass(supplier.total_score)
            )}>
              {supplier.total_score}
            </span>
            <span className="text-[10px] text-gray-400">{scoreLabel(supplier.total_score)}</span>
          </div>
        </td>

        {/* Company */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              title={expanded ? "Collapse" : "Expand details"}
            >
              {expanded
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight truncate max-w-[180px]">
                {supplier.company_name}
              </p>
              {supplier.website ? (
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 hover:underline truncate max-w-[170px]"
                  title={supplier.website}
                >
                  <Globe className="h-2.5 w-2.5 shrink-0" />
                  {supplier.website.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              ) : null}
            </div>
          </div>
        </td>

        {/* Location */}
        <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate max-w-[110px]">{supplier.state ?? "—"}</span>
          </div>
        </td>

        {/* Rating */}
        <td className="px-3 py-3 whitespace-nowrap">
          {supplier.rating != null ? (
            <div className="flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium text-gray-700">{supplier.rating.toFixed(1)}</span>
            </div>
          ) : <span className="text-gray-400 text-sm">—</span>}
        </td>

        {/* Trust */}
        <td className="px-3 py-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            {supplier.verified && (
              <span title="Platform verified">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
              </span>
            )}
            {supplier.iec_verified && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1">IEC</span>
            )}
            {!supplier.verified && !supplier.iec_verified && (
              <span className="text-gray-300 text-xs">—</span>
            )}
          </div>
        </td>

        {/* Certifications */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1 items-center">
            {supplier.certifications?.slice(0, 3).map((c) => (
              <span key={c} className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                {c}
              </span>
            ))}
            {(supplier.certifications?.length ?? 0) > 3 && (
              <span className="relative group/certs">
                <span className="cursor-default text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 hover:bg-emerald-100 transition-colors">
                  +{(supplier.certifications?.length ?? 0) - 3}
                </span>
                {/* Tooltip */}
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30
                  invisible group-hover/certs:visible opacity-0 group-hover/certs:opacity-100
                  transition-opacity duration-150">
                  <span className="block bg-gray-900 text-white text-[11px] font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    {supplier.certifications?.slice(3).join("  ·  ")}
                  </span>
                  {/* Arrow */}
                  <span className="block w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                </span>
              </span>
            )}
            {!supplier.certifications?.length && (
              <span className="text-gray-300 text-xs">—</span>
            )}
          </div>
        </td>

        {/* Source — plain badge only */}
        <td className="px-3 py-3 whitespace-nowrap">
          <span className={cn(
            "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
            sourceColor(supplier.source)
          )}>
            {supplier.source ?? "—"}
          </span>
        </td>

        {/* Status */}
        <td className="px-3 py-3 whitespace-nowrap">
          <span className={cn(
            "inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
            statusClass(supplier.status)
          )}>
            {supplier.status}
          </span>
        </td>

        {/* Actions */}
        <td className="px-3 py-3 whitespace-nowrap">
          {supplier.status === "new" ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onApprove(supplier.id)}
                disabled={isApproving}
                title="Approve — saves to /suppliers"
                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
              >
                {isApproving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CheckCircle className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onReject(supplier)}
                disabled={isApproving}
                title="Reject"
                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ) : supplier.status === "approved" ? (
            <Link href="/suppliers" className="text-xs text-emerald-700 hover:underline font-medium">
              View ↗
            </Link>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      </tr>

      {expanded && <DetailRow supplier={supplier} />}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const STATES   = ["Maharashtra", "Tamil Nadu", "Karnataka", "Gujarat", "Rajasthan", "Andhra Pradesh", "Telangana", "Kerala", "Madhya Pradesh", "Punjab", "Other"];
const SOURCES  = ["APEDA", "IndiaMART", "TradeIndia"];

export default function SupplierDiscoverPage() {
  const [suppliers, setSuppliers]       = useState<DiscoveredSupplier[]>([]);
  const [loading, setLoading]           = useState(true);
  const [discovering, setDiscovering]   = useState(false);
  const [lastSources, setLastSources]   = useState<{ IndiaMART: number; TradeIndia: number; APEDA: number } | null>(null);
  const [approving, setApproving]       = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DiscoveredSupplier | null>(null);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [total, setTotal]               = useState(0);

  const [activeCard, setActiveCard] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    scoreMin:   "0",
    state:      "",
    source:     "",
    status:     "new,approved",
    sortBy:     "total_score",
    hasContact: false,
  });

  const stats = {
    total,
    highQuality: suppliers.filter((s) => s.total_score >= 80).length,
    approved:    suppliers.filter((s) => s.status === "approved").length,
    withContact: suppliers.filter((s) => s.phone || s.email).length,
  };

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        score_min: filters.scoreMin,
        status:    filters.status,
        sort_by:   filters.sortBy,
        limit:     "100",
        offset:    "0",
      });
      if (filters.state)      params.set("state",       filters.state);
      if (filters.source)     params.set("source",      filters.source);
      if (filters.hasContact) params.set("has_contact", "true");

      const res  = await fetch(`/api/suppliers/discovered?${params}`);
      const json = await res.json();

      if (json.success) {
        setSuppliers(json.data);
        setTotal(json.pagination.total);
      } else {
        showToast(json.error ?? "Failed to load", false);
      }
    } catch {
      showToast("Network error loading suppliers", false);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // ── Stat card click → apply filter ───────────────────────────────────────
  function handleCardClick(card: string) {
    if (activeCard === card) {
      // Toggle off — reset to defaults
      setActiveCard(null);
      setFilters({ scoreMin: "0", state: "", source: "", status: "new,approved", sortBy: "total_score", hasContact: false });
      return;
    }
    setActiveCard(card);
    if (card === "total")       setFilters((f) => ({ ...f, scoreMin: "0",  status: "new,approved,rejected", hasContact: false }));
    if (card === "highQuality") setFilters((f) => ({ ...f, scoreMin: "80", status: "new,approved",          hasContact: false }));
    if (card === "approved")    setFilters((f) => ({ ...f, scoreMin: "0",  status: "approved",              hasContact: false }));
    if (card === "withContact") setFilters((f) => ({ ...f, scoreMin: "0",  status: "new,approved",          hasContact: true  }));
  }

  // ── Discover (always real-time) ───────────────────────────────────────────
  async function handleDiscover() {
    setDiscovering(true);
    try {
      const res  = await fetch("/api/suppliers/discover", { method: "POST" });
      const json = await res.json();

      if (json.success) {
        setLastSources(json.sources ?? null);
        const parts = [];
        if (json.inserted > 0) parts.push(`${json.inserted} new`);
        if (json.updated  > 0) parts.push(`${json.updated} updated`);
        const msg = parts.length > 0
          ? `Discovery complete — ${parts.join(", ")} suppliers with full contact info`
          : json.note ?? "Discovery complete — 0 new suppliers with phone found this run.";
        showToast(msg, json.suppliers_found > 0);
        load();
      } else {
        showToast(json.error ?? "Discovery failed", false);
      }
    } catch {
      showToast("Network error during discovery", false);
    } finally {
      setDiscovering(false);
    }
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove(id: string) {
    setApproving(id);
    try {
      const res  = await fetch(`/api/suppliers/discovered/${id}/approve`, { method: "POST" });
      const json = await res.json();
      showToast(json.message ?? (json.success ? "Approved!" : json.error), json.success);
      if (json.success) load();
    } catch {
      showToast("Failed to approve", false);
    } finally {
      setApproving(null);
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setRejectTarget(null);
    try {
      const res  = await fetch(`/api/suppliers/discovered/${id}/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason }),
      });
      const json = await res.json();
      showToast(json.message ?? (json.success ? "Rejected" : json.error), json.success);
      if (json.success) load();
    } catch {
      showToast("Failed to reject", false);
    }
  }

  return (
    <div className="p-8 space-y-6">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg",
          toast.ok ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/suppliers"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supplier Discovery</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Live scraping of verified moringa exporters from IndiaMART Export Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="btn-primary text-sm py-2 min-w-[160px] justify-center"
          >
            {discovering
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Discovering…</>
              : <><Zap className="h-4 w-4" /> Run Discovery</>}
          </button>
        </div>
      </div>

      {/* Last run source breakdown */}
      {lastSources && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-6 text-sm">
          <span className="font-medium text-emerald-800">Last run:</span>
          <span className="text-emerald-700">🏭 IndiaMART Export Portal: <strong>{lastSources.IndiaMART}</strong> verified exporters</span>
          {lastSources.APEDA > 0 && <span className="text-emerald-700">🏛 APEDA: <strong>{lastSources.APEDA}</strong></span>}
          {lastSources.TradeIndia > 0 && <span className="text-emerald-700">🔵 TradeIndia: <strong>{lastSources.TradeIndia}</strong></span>}
        </div>
      )}

      {/* Stats — click to filter */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { id: "total",       label: "Total Discovered",  value: total,              hint: "Show all"              },
          { id: "highQuality", label: "High Quality (≥80)", value: stats.highQuality, hint: "Filter score ≥ 80"     },
          { id: "approved",    label: "Approved",           value: stats.approved,    hint: "Show approved only"    },
          { id: "withContact", label: "With Contact Info",  value: stats.withContact, hint: "Has phone or email"    },
        ].map(({ id, label, value, hint }) => (
          <button
            key={id}
            onClick={() => handleCardClick(id)}
            title={hint}
            className={cn(
              "card px-5 py-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none",
              activeCard === id
                ? "ring-2 ring-emerald-600 border-emerald-300 bg-emerald-50"
                : "hover:border-emerald-200"
            )}
          >
            <p className={cn(
              "text-xs font-medium uppercase tracking-wide",
              activeCard === id ? "text-emerald-700" : "text-gray-400"
            )}>
              {label}
            </p>
            <p className={cn(
              "mt-1.5 text-3xl font-bold",
              activeCard === id ? "text-emerald-700" : "text-emerald-700"
            )}>
              {value}
            </p>
            {activeCard === id && (
              <p className="mt-1 text-[10px] text-emerald-600 font-medium">● filtering · click to clear</p>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card px-5 py-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="label">Min Score</label>
          <select className="input py-1.5 text-sm w-28"
            value={filters.scoreMin}
            onChange={(e) => setFilters((f) => ({ ...f, scoreMin: e.target.value }))}>
            <option value="0">All</option>
            <option value="60">60+</option>
            <option value="80">80+</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">State</label>
          <select className="input py-1.5 text-sm w-40"
            value={filters.state}
            onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}>
            <option value="">All states</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">Source</label>
          <select className="input py-1.5 text-sm w-36"
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">Status</label>
          <select className="input py-1.5 text-sm w-44"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="new,approved">New &amp; Approved</option>
            <option value="new">New only</option>
            <option value="approved">Approved only</option>
            <option value="rejected">Rejected</option>
            <option value="new,approved,rejected">All</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">Sort by</label>
          <select className="input py-1.5 text-sm w-36"
            value={filters.sortBy}
            onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}>
            <option value="total_score">Score</option>
            <option value="rating">Rating</option>
            <option value="company_name">Name</option>
            <option value="created_at">Date added</option>
          </select>
        </div>
        <button onClick={load} className="btn-secondary text-sm py-1.5 ml-auto" title="Refresh">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Score legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Score:</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200 mr-1" />80–100 High</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-200 mr-1" />60–79 Medium</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-200 mr-1" />&lt;60 Low</span>
        <span className="text-gray-400 ml-2">· Website shown under company name when available</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emerald-900 text-white">
              <tr>
                <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide w-16">Score</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide">Company</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide">State</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide w-16">Rating</th>
                <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide w-14">Trust</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide">Certs</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide w-28">Source</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide w-24">Status</th>
                <th className="px-3 py-3 text-left  font-semibold text-xs uppercase tracking-wide w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <p className="text-sm">Loading suppliers…</p>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <Zap className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500 mb-1">No suppliers yet</p>
                    <p className="text-xs text-gray-400">
                      Click{" "}
                      <button onClick={handleDiscover} className="text-emerald-700 hover:underline font-medium">
                        Run Discovery
                      </button>
                      {" "}to fetch real-time supplier data, or adjust your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <SupplierRow
                    key={s.id}
                    supplier={s}
                    onApprove={handleApprove}
                    onReject={setRejectTarget}
                    approving={approving}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && suppliers.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between text-xs text-gray-400">
            <span>Showing {suppliers.length} of {total} supplier{total !== 1 ? "s" : ""}</span>
            <Link href="/suppliers" className="text-emerald-700 hover:underline font-medium">
              View approved in /suppliers →
            </Link>
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectModal
          supplier={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}
