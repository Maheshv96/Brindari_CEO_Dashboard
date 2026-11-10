"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, XCircle, PencilLine, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── Types (tables from supabase/migrations/20261110000001_agent_tracker.sql) ──
type Activity = { id: string; created_at: string; actor: string; action: string; item: string; status: string; needs_approval: boolean; notes: string | null };
type Task = { id: string; created_at: string; task: string; owner: string; priority: "high" | "medium" | "low"; status: string; due_date: string | null; blocker: string | null };
type Output = { id: string; created_at: string; agent: string; kind: string; title: string; body: string; audience: string };
type Approval = { id: string; created_at: string; item: string; requested_by: string; reason: string; risk: string; atlas_review: string | null; output_id: string | null; decision: string; decided_by: string | null; decided_at: string | null; decision_note: string | null };
type Diversification = { id: string; created_at: string; product: string; stage: string; screen_result: string; owner: string; next_gate_date: string | null; reason: string | null };
type Compliance = { id: string; created_at: string; item: string; type: string; status: string; owner: string; next_action: string | null };

const AGENTS: { key: string; name: string; role: string; schedule: string }[] = [
  { key: "atlas",   name: "Atlas",   role: "chief of staff",              schedule: "Daily 7 PM · weekly Sat" },
  { key: "scout",   name: "Scout",   role: "buyer researcher",            schedule: "Mon–Sat 9 AM" },
  { key: "harvest", name: "Harvest", role: "supplier sourcing lead",      schedule: "Mon–Sat 10 AM" },
  { key: "compass", name: "Compass", role: "compliance tracker",          schedule: "Mon–Sat 11 AM*" },
  { key: "herald",  name: "Herald",  role: "outreach writer",             schedule: "Mon–Sat 12 PM" },
  { key: "vista",   name: "Vista",   role: "diversification researcher",  schedule: "Mon, Thu 2 PM" },
  { key: "radar",   name: "Radar",   role: "opportunity scout",           schedule: "Tue, Fri 3 PM" },
  { key: "quill",   name: "Quill",   role: "website and listings writer", schedule: "On request" },
  { key: "pulse",   name: "Pulse",   role: "social media manager",        schedule: "On request" },
  { key: "ledger",  name: "Ledger",  role: "orders and finance tracker",  schedule: "After first orders" },
  { key: "courier", name: "Courier", role: "logistics coordinator",       schedule: "After first orders" },
];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function AgentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string>("dashboard user");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [reports, setReports] = useState<Output[]>([]);
  const [reportIdx, setReportIdx] = useState(0);
  const [div, setDiv] = useState<Diversification[]>([]);
  const [comp, setComp] = useState<Compliance[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [u, a, t, ap, r, d, c] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("agent_activity").select("id,created_at,actor,action,item,status,needs_approval,notes").order("created_at", { ascending: false }).limit(200),
      supabase.from("agent_tasks").select("*").neq("status", "done").order("created_at", { ascending: true }),
      supabase.from("agent_approvals").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("agent_outputs").select("id,created_at,agent,kind,title,body,audience").in("kind", ["daily-update", "weekly-review"]).order("created_at", { ascending: false }).limit(14),
      supabase.from("agent_diversification").select("id,created_at,product,stage,screen_result,owner,next_gate_date,reason").order("created_at", { ascending: false }).limit(200),
      supabase.from("agent_compliance").select("id,created_at,item,type,status,owner,next_action").order("created_at", { ascending: false }).limit(200),
    ]);
    const firstErr = [a, t, ap, r, d, c].find(x => x.error)?.error;
    if (firstErr) setError(`${firstErr.message}. If this says the table is missing, the agent tracker migration has not been applied yet.`);
    setMe(u.data.user?.email ?? "dashboard user");
    setActivity((a.data ?? []) as Activity[]);
    setTasks((t.data ?? []) as Task[]);
    setApprovals((ap.data ?? []) as Approval[]);
    setReports((r.data ?? []) as Output[]);
    setReportIdx(0);
    // latest row per product / item
    const latest = <T extends { created_at: string }>(rows: T[], key: (x: T) => string) => {
      const m = new Map<string, T>();
      for (const x of rows) if (!m.has(key(x).toLowerCase())) m.set(key(x).toLowerCase(), x);
      return Array.from(m.values());
    };
    setDiv(latest((d.data ?? []) as Diversification[], x => x.product));
    setComp(latest((c.data ?? []) as Compliance[], x => x.item));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function decide(ap: Approval, decision: "approved" | "rejected" | "changed", note: string) {
    const { error: e } = await supabase.from("agent_approvals")
      .update({ decision, decided_by: me, decided_at: new Date().toISOString(), decision_note: note || null })
      .eq("id", ap.id);
    if (e) { setError(e.message); return; }
    await supabase.from("agent_activity").insert({
      actor: me, action: `approval ${decision}`, item: ap.item, status: "done", needs_approval: false,
      source: "CEO dashboard /agents", notes: note || null,
    });
    load();
  }

  async function setTaskStatus(task: Task, status: string) {
    const { error: e } = await supabase.from("agent_tasks").update({ status }).eq("id", task.id);
    if (e) { setError(e.message); return; }
    await supabase.from("agent_activity").insert({ actor: me, action: `task ${status}`, item: task.task, status: "done", needs_approval: false, source: "CEO dashboard /agents" });
    load();
  }

  const pending = approvals.filter(a => a.decision === "pending");
  const decided = approvals.filter(a => a.decision !== "pending").slice(0, 10);
  const lastRun = (key: string) => activity.find(a => a.actor.toLowerCase() === key);
  const report = reports[reportIdx];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bot className="h-6 w-6 text-emerald-700" /> Agents</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? "Loading…" : <>{pending.length} waiting for you · {tasks.length} open tasks · runs in the cloud on schedule</>}
          </p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
      </div>

      {error && <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      {/* Needs you */}
      <section className="card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Waiting for your decision ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-gray-500">Nothing waiting. Agents add drafts, sample requests and other approvals here.</p>}
        {pending.map(ap => <ApprovalCard key={ap.id} ap={ap} supabase={supabase} onDecide={decide} />)}
      </section>

      {/* Atlas report */}
      <section className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Atlas [chief of staff]: latest update</h2>
          {reports.length > 1 && (
            <select className="input max-w-xs" value={reportIdx} onChange={e => setReportIdx(Number(e.target.value))}>
              {reports.map((r, i) => <option key={r.id} value={i}>{r.kind === "weekly-review" ? "Weekly review" : "Daily update"} · {fmt(r.created_at)}</option>)}
            </select>
          )}
        </div>
        {report
          ? <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800 max-h-[32rem] overflow-y-auto">{report.body}</pre>
          : <p className="text-sm text-gray-500">No update yet. Atlas posts one every evening at 7 PM IST.</p>}
      </section>

      {/* Agents roster */}
      <section className="card p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Your agents</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map(ag => {
            const last = lastRun(ag.key);
            const ranToday = last && istDay(last.created_at) === todayIST();
            return (
              <div key={ag.key} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">{ag.name} <span className="font-normal text-gray-500">[{ag.role}]</span></p>
                  <span className={cn("badge", ranToday ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>{ranToday ? "ran today" : "idle"}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{ag.schedule}</p>
                <p className="mt-1 text-xs text-gray-600 truncate">{last ? `${fmt(last.created_at)} · ${last.action}: ${last.item}` : "No activity yet"}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-400">* Compass runs daily until 24 Nov 2026, then Mondays and Thursdays.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Tasks */}
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Open tasks ({tasks.length})</h2>
          <ul className="divide-y divide-gray-100">
            {tasks.map(t => (
              <li key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">{t.task}</p>
                  <p className="text-xs text-gray-500">{t.owner} · {t.priority}{t.due_date ? ` · due ${t.due_date}` : ""}{t.blocker ? ` · blocker: ${t.blocker}` : ""}</p>
                </div>
                <select className="input w-36 shrink-0 text-xs" value={t.status} onChange={e => setTaskStatus(t, e.target.value)}>
                  {["not started", "in progress", "blocked", "done"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </li>
            ))}
            {tasks.length === 0 && <li className="py-2 text-sm text-gray-500">No open tasks.</li>}
          </ul>
        </section>

        {/* Activity */}
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Activity</h2>
          <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {activity.slice(0, 60).map(a => (
              <li key={a.id} className="py-2 text-sm">
                <span className="text-xs text-gray-400">{fmt(a.created_at)}</span>{" "}
                <span className="font-medium text-gray-800">{a.actor}</span>{" "}
                <span className="text-gray-600">{a.action}: {a.item}</span>
                {a.needs_approval && <span className="badge ml-2 bg-amber-50 text-amber-700">needs approval</span>}
              </li>
            ))}
            {activity.length === 0 && <li className="py-2 text-sm text-gray-500">No activity yet.</li>}
          </ul>
        </section>

        {/* Compliance */}
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Compliance (Compass)</h2>
          <SimpleTable
            head={["Item", "Type", "Status", "Next action"]}
            rows={comp.map(c => [c.item, c.type, c.status, c.next_action ?? ""])}
            empty="Compass has not logged anything yet." />
        </section>

        {/* Diversification */}
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Diversification pipeline (Vista)</h2>
          <SimpleTable
            head={["Product", "Stage", "Screen", "Next gate"]}
            rows={div.map(d => [d.product, d.stage, d.screen_result, d.next_gate_date ?? ""])}
            empty="Vista has not screened a product yet." />
        </section>
      </div>

      {decided.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent decisions</h2>
          <SimpleTable
            head={["Item", "Decision", "By", "When", "Note"]}
            rows={decided.map(a => [a.item, a.decision, a.decided_by ?? "", a.decided_at ? fmt(a.decided_at) : "", a.decision_note ?? ""])}
            empty="" />
        </section>
      )}
    </div>
  );
}

function ApprovalCard({ ap, supabase, onDecide }: {
  ap: Approval;
  supabase: ReturnType<typeof createClient>;
  onDecide: (ap: Approval, d: "approved" | "rejected" | "changed", note: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!open && body === null && ap.output_id) {
      const { data } = await supabase.from("agent_outputs").select("body").eq("id", ap.output_id).single();
      setBody((data as { body: string } | null)?.body ?? "(draft not found)");
    }
    setOpen(o => !o);
  }
  async function act(d: "approved" | "rejected" | "changed") {
    setBusy(true);
    await onDecide(ap, d, note);
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{ap.item}</p>
          <p className="text-xs text-gray-500">{ap.requested_by} · {fmt(ap.created_at)} · risk: {ap.risk}</p>
        </div>
        {ap.output_id && (
          <button className="btn-secondary text-xs" onClick={toggle}>
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {open ? "Hide" : "View"} draft
          </button>
        )}
      </div>
      <p className="text-sm text-gray-700">{ap.reason}</p>
      {ap.atlas_review && <p className="text-sm text-gray-700"><span className="font-medium">Atlas:</span> {ap.atlas_review}</p>}
      {open && body !== null && (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800 bg-white border border-gray-200 rounded-md p-3 max-h-96 overflow-y-auto">{body}</pre>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input className="input flex-1 min-w-[12rem]" placeholder="Note (optional, e.g. what to change)" value={note} onChange={e => setNote(e.target.value)} />
        <button className="btn-primary" disabled={busy} onClick={() => act("approved")}><CheckCircle2 className="h-4 w-4" /> Approve</button>
        <button className="btn-secondary" disabled={busy} onClick={() => act("changed")}><PencilLine className="h-4 w-4" /> Needs changes</button>
        <button className="btn-secondary text-red-700" disabled={busy} onClick={() => act("rejected")}><XCircle className="h-4 w-4" /> Reject</button>
      </div>
      <p className="text-xs text-gray-400">Approving records your decision. Nothing is sent automatically: send approved emails from Email Campaigns.</p>
    </div>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr>{head.map(h => <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-2 text-gray-700 align-top">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
