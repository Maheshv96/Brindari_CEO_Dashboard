"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, FolderOpen, CheckCircle, Circle, ExternalLink, Download, Loader2, Share2 } from "lucide-react";
import { DetailModal } from "@/components/ui/DetailModal";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { Document } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type DocRow = Document & {
  orders: { order_number: string; buyers: { company: string } | null } | null;
};
type OrderOption = { id: string; order_number: string; buyers: { company: string } | null };

const DOC_LABELS: Record<Document["doc_type"], string> = {
  bill_of_lading:        "Bill of Lading",
  packing_list:          "Packing List",
  certificate_of_origin: "Certificate of Origin",
  phytosanitary:         "Phytosanitary Certificate",
  fssai:                 "FSSAI Certificate",
  commercial_invoice:    "Commercial Invoice",
  insurance:             "Insurance",
  other:                 "Other",
};

const REQUIRED_DOCS: Document["doc_type"][] = [
  "bill_of_lading", "packing_list", "certificate_of_origin",
  "phytosanitary", "fssai", "commercial_invoice",
];

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-gray-100 text-gray-600",
  uploaded: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  shared:   "bg-teal-100 text-teal-700",
};

// ── Upload modal ───────────────────────────────────────────────────────────────
function UploadModal({ orders, onClose, onUploaded }: {
  orders: OrderOption[];
  onClose: () => void;
  onUploaded: (d: DocRow) => void;
}) {
  const supabase = createClient();
  const [form, setForm]   = useState({ order_id: "", doc_type: "" as Document["doc_type"] | "", notes: "" });
  const [file, setFile]   = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err,   setErr]   = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.order_id)  { setErr("Select an order."); return; }
    if (!form.doc_type)  { setErr("Select document type."); return; }
    if (!file)           { setErr("Choose a file."); return; }
    setSaving(true); setErr(null);

    try {
      const ts   = Date.now();
      const path = `${form.order_id}/${form.doc_type}_${ts}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) {
        if (upErr.message?.includes("bucket") || upErr.message?.includes("not found")) {
          throw new Error('Storage bucket "documents" not found. Create it in Supabase Dashboard → Storage → New Bucket → name: documents → Public.');
        }
        throw upErr;
      }

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const { data, error: dbErr } = await supabase.from("documents")
        .insert({
          order_id:  form.order_id,
          doc_type:  form.doc_type as Document["doc_type"],
          file_name: file.name,
          file_url:  fileUrl,
          status:    "uploaded",
          shared_with_buyer: false,
        })
        .select("*, orders(order_number, buyers(company))")
        .single();
      if (dbErr) throw dbErr;
      onUploaded(data as DocRow);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}
          <div>
            <label className="label">Order *</label>
            <select className="input" value={form.order_id} onChange={e => set("order_id", e.target.value)} required>
              <option value="">Select order…</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.buyers?.company ?? "?"}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Document Type *</label>
            <select className="input" value={form.doc_type} onChange={e => set("doc_type", e.target.value)} required>
              <option value="">Select type…</option>
              {(Object.entries(DOC_LABELS) as [Document["doc_type"], string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">File *</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Inline status select ───────────────────────────────────────────────────────
function StatusSelect({ docId, value, onChange }: {
  docId: string; value: string; onChange: (id: string, v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(docId, e.target.value)}
      className={cn("rounded-full border-0 py-0.5 pl-2.5 pr-7 text-xs font-medium cursor-pointer focus:outline-none", STATUS_COLORS[value] ?? "bg-gray-100 text-gray-600")}
    >
      {Object.entries(STATUS_COLORS).map(([k]) => <option key={k} value={k} className="capitalize">{k}</option>)}
    </select>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const supabase = createClient();
  const [docs,    setDocs]    = useState<DocRow[]>([]);
  const [orders,  setOrders]  = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState(false);
  const [orderFilter, setOrderFilter] = useState("");
  const [detail,      setDetail]      = useState<DocRow | null>(null);
  const [sharing,     setSharing]     = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [{ data: dData, error: dErr }, { data: oData, error: oErr }] = await Promise.all([
      supabase.from("documents").select("*, orders(order_number, buyers(company))").order("created_at", { ascending: false }),
      supabase.from("orders").select("id, order_number, buyers(company)").not("status", "in", '("cancelled")').order("created_at", { ascending: false }),
    ]);
    if (dErr || oErr) { setError((dErr ?? oErr)!.message); setLoading(false); return; }
    setDocs((dData ?? []) as DocRow[]);
    setOrders((oData ?? []) as unknown as OrderOption[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Checklist: which required doc types are uploaded across all docs
  const uploadedTypes = useMemo(() => new Set(docs.map(d => d.doc_type)), [docs]);

  // Filtered list
  const filtered = orderFilter ? docs.filter(d => d.order_id === orderFilter) : docs;

  async function handleStatusChange(id: string, status: string) {
    await supabase.from("documents").update({ status }).eq("id", id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: status as Document["status"] } : d));
  }

  async function handleDownload(doc: DocRow) {
    if (!doc.file_url) return;

    // Placeholder URLs — inform user
    if (doc.file_url.includes("placeholder.com")) {
      alert("This is a demo document with a placeholder URL.\nUpload a real file via the Upload button to enable downloads.");
      return;
    }

    setDownloading(doc.id);
    try {
      const res = await fetch(`/api/documents/download?id=${doc.id}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  async function shareWithBuyer(docId: string) {
    setSharing(docId);
    await supabase.from("documents").update({ shared_with_buyer: true, status: "shared" }).eq("id", docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, shared_with_buyer: true, status: "shared" as Document["status"] } : d));
    setSharing(null);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-0.5 text-sm text-gray-500">{loading ? "Loading…" : `${docs.length} documents`}</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" /> Upload Document
        </button>
      </div>

      {/* Checklist banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Required export documents checklist</p>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_DOCS.map(type => {
            const done = uploadedTypes.has(type);
            return (
              <span key={type} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                done ? "bg-green-100 text-green-700" : "bg-white text-gray-500 border border-gray-200")}>
                {done ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {DOC_LABELS[type]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select className="input w-64" value={orderFilter} onChange={e => setOrderFilter(e.target.value)}>
          <option value="">All orders</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.buyers?.company ?? "?"}</option>)}
        </select>
        {orderFilter && <button onClick={() => setOrderFilter("")} className="text-sm text-gray-400 hover:text-gray-600">✕ Clear</button>}
      </div>

      {error && <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["File", "Order / Buyer", "Doc Type", "Status", "Uploaded", "Buyer Access", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
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
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  {docs.length === 0
                    ? <><button className="text-emerald-700 hover:underline" onClick={() => setModal(true)}>Upload your first document →</button></>
                    : "No documents match the filter."}
                </td></tr>
              ) : (
                filtered.map(doc => (
                  <tr key={doc.id} onClick={() => setDetail(doc)} className="group hover:bg-gray-50/50 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono font-medium text-gray-900">{doc.orders?.order_number ?? "—"}</p>
                      <p className="text-xs text-gray-400">{doc.orders?.buyers?.company ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{DOC_LABELS[doc.doc_type]}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <StatusSelect docId={doc.id} value={doc.status} onChange={handleStatusChange} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      {doc.shared_with_buyer ? (
                        <span className="badge bg-teal-100 text-teal-700">Shared</span>
                      ) : (
                        <button
                          onClick={() => shareWithBuyer(doc.id)}
                          disabled={sharing === doc.id}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-700 disabled:opacity-40"
                        >
                          {sharing === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                          Share
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.file_url && (
                          <>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="View in new tab">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => handleDownload(doc)}
                              disabled={downloading === doc.id}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-700 disabled:opacity-40" title="Download">
                              {downloading === doc.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />}
                            </button>
                          </>
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

      {modal && (
        <UploadModal
          orders={orders}
          onClose={() => setModal(false)}
          onUploaded={d => { setDocs(prev => [d, ...prev]); setModal(false); }}
        />
      )}

      {detail && (
        <DetailModal
          title={detail.file_name}
          subtitle={DOC_LABELS[detail.doc_type]}
          badge={{ label: detail.status, className: STATUS_COLORS[detail.status] ?? "bg-gray-100 text-gray-600" }}
          onClose={() => setDetail(null)}
          fields={[
            { label: "File Name",       value: detail.file_name },
            { label: "Document Type",   value: DOC_LABELS[detail.doc_type] },
            { label: "Order",           value: detail.orders?.order_number },
            { label: "Buyer",           value: detail.orders?.buyers?.company },
            { label: "Status",          value: detail.status },
            { label: "Shared w/ Buyer", value: detail.shared_with_buyer ? "Yes" : "No" },
            { label: "Uploaded",        value: new Date(detail.created_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) },
          ]}
          actions={
            <>
              <button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>
              {detail.file_url && (
                <button className="btn-primary" disabled={downloading === detail.id}
                  onClick={() => handleDownload(detail)}>
                  {downloading === detail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download File
                </button>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
