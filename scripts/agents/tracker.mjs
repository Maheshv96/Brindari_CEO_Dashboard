#!/usr/bin/env node
/**
 * Brindari shared tracker (BRIEF.md section 5), stored in Supabase.
 * The same commands work on a Mac and in cloud routines. Add-only: no command edits or deletes.
 *
 *   tracker tabs                                  list tabs
 *   tracker columns <tab>                         fields, required/optional, allowed values
 *   tracker read <tab> [--last N] [--since YYYY-MM-DD] [--where col=value]...
 *   tracker append <tab> '<json object | array>'  add rows (max 50 per call)
 *   tracker output <agent> <kind> "<title>" --file <path> [--external] [--needs-approval]
 *                                                 save a report/draft; prints its id
 *   tracker output-read <id>                      print one saved output
 *   tracker read <sheet> --workbook <name>        founders' research workbooks (read only):
 *                                                 master, contacts, marketing, trademap, actionpack
 *   tracker read --workbook <name>                list that workbook's sheets
 */
import { readFileSync } from "node:fs";
import { fail as f0, supabase, IDENT, istNow } from "./lib.mjs";

const P = "agent:tracker";
const fail = (m, c) => f0(P, m, c);
const db = supabase(P);

const STATUS = ["not started", "in progress", "blocked", "done"];
// tab -> [table, [column, allowed|null, required]]
const TABS = {
  activity:         ["agent_activity", [["actor", null, 1], ["action", null, 1], ["item", null, 1], ["status", null, 1], ["needs_approval", ["yes", "no"], 1], ["source", null, 0], ["notes", null, 0]]],
  tasks:            ["agent_tasks", [["task", null, 1], ["owner", null, 1], ["priority", ["high", "medium", "low"], 1], ["status", STATUS, 1], ["due_date", null, 0], ["blocker", null, 0], ["created_by", null, 0]]],
  approvals:        ["agent_approvals", [["item", null, 1], ["requested_by", null, 1], ["reason", null, 1], ["risk", null, 1], ["atlas_review", null, 0], ["output_id", null, 0], ["decision", ["pending"], 1]]],
  decisions:        ["agent_decisions", [["decided_on", null, 0], ["decision", null, 1], ["who_decided", null, 1], ["reason", null, 0], ["what_it_changes", null, 0]]],
  diversification:  ["agent_diversification", [["product", null, 1], ["hs_code", null, 0], ["stage", ["screen", "gate 0", "gate 1", "gate 2", "gate 3", "gate 4", "gate 5", "gate 6", "dropped"], 1], ["screen_result", ["pass", "fail", "unclear", "pending"], 1], ["owner", null, 1], ["next_gate_date", null, 0], ["go_no_go", ["go", "wait", "drop", "pending"], 0], ["reason", null, 0], ["sources", null, 0]]],
  compliance:       ["agent_compliance", [["item", null, 1], ["type", ["registration", "certification", "filing", "other"], 1], ["status", ["held", "applied", "not held", "unknown"], 1], ["number_ref", null, 0], ["expiry", null, 0], ["evidence", null, 0], ["owner", null, 1], ["next_action", null, 0]]],
  marketing:        ["agent_marketing_kpis", [["week_start", null, 1], ["fb_reach", null, 0], ["sample_leads", null, 0], ["group_posts", null, 0], ["linkedin_connections", null, 0], ["linkedin_posts", null, 0], ["source", null, 0], ["notes", null, 0]]],
  prospects:        ["agent_prospects", [["company", null, 1], ["country", null, 1], ["contact", null, 0], ["verification", ["VERIFIED", "PARTIAL", "REJECTED"], 1], ["evidence", null, 1], ["source_list", null, 0], ["notes", null, 0]]],
  supplier_reviews: ["agent_supplier_reviews", [["supplier_name", null, 1], ["location", null, 0], ["source", null, 0], ["discovered_supplier_id", null, 0], ["quality", null, 0], ["price", null, 0], ["lead_time", null, 0], ["trust", null, 0], ["communication", null, 0], ["certifications_claimed", null, 0], ["certificates_seen", null, 0], ["recommendation", ["approve", "reject", "needs info"], 1], ["evidence", null, 0], ["notes", null, 0]]],
  outputs:          ["agent_outputs", null],
};
const WORKBOOKS = ["master", "contacts", "marketing", "trademap", "actionpack"];

function opt(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  if (i + 1 >= args.length) fail(`${name} needs a value`, 2);
  return args.splice(i, 2)[1];
}
function opts(args, name) { const out = []; let v; while ((v = opt(args, name)) !== undefined) out.push(v); return out; }
function tab(name) {
  const t = TABS[String(name || "").toLowerCase()];
  if (!t) fail(`unknown tab '${name}'. Tabs: ${Object.keys(TABS).join(", ")}`, 2);
  return t;
}
const print = x => console.log(JSON.stringify(x, null, 1));

async function readWorkbook(args) {
  const wb = opt(args, "--workbook");
  if (!WORKBOOKS.includes(wb)) fail(`--workbook must be one of ${WORKBOOKS.join(", ")}`, 2);
  const last = Number(opt(args, "--last") || 0);
  const sheet = args[0];
  if (!sheet) {
    const rows = await db.get("agent_sources", { select: "sheet", workbook: `eq.${wb}`, limit: "10000" });
    return print([...new Set(rows.map(r => r.sheet))]);
  }
  const rows = await db.get("agent_sources", { select: "row_num,data", workbook: `eq.${wb}`, sheet: `eq.${sheet}`, order: "row_num.asc", limit: "5000" });
  if (!rows.length) fail(`no rows for sheet '${sheet}' in ${wb} (run 'tracker read --workbook ${wb}' to list sheets)`, 2);
  const data = rows.map(r => r.data);
  print({ workbook: wb, sheet, note: "Source-file claims (e.g. 'verified', certifications) are UNVERIFIED until checked.", rows: last ? data.slice(-last) : data });
}

async function read(args) {
  if (args.includes("--workbook")) return readWorkbook(args);
  const last = Number(opt(args, "--last") || 0);
  const since = opt(args, "--since");
  const where = opts(args, "--where");
  const [table] = tab(args[0]);
  const params = { select: table === "agent_outputs" ? "id,created_at,agent,kind,title,audience,needs_approval" : "*", order: "created_at.desc", limit: String(last > 0 ? Math.min(last, 1000) : 500) };
  if (since) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) fail("--since expects YYYY-MM-DD (IST)", 2);
    params.created_at = `gte.${since}T00:00:00+05:30`;
  }
  for (const w of where) {
    const i = w.indexOf("=");
    if (i < 1 || !IDENT.test(w.slice(0, i))) fail(`--where expects col=value, got '${w}'`, 2);
    params[w.slice(0, i)] = `eq.${w.slice(i + 1)}`;
  }
  const rows = await db.get(table, params);
  print(rows.reverse());
}

function validate(row, cols, i) {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail(`row ${i + 1} is not an object`, 2);
  const names = cols.map(c => c[0]);
  const unknown = Object.keys(row).filter(k => !names.includes(k));
  if (unknown.length) fail(`row ${i + 1}: unknown column(s) ${unknown.join(", ")}. Expected: ${names.join(", ")}`, 2);
  const out = {};
  for (const [col, allowed, req] of cols) {
    let v = row[col];
    if (req && (v === undefined || v === null || String(v).trim() === "")) fail(`row ${i + 1}: missing required '${col}'`, 2);
    if (v === undefined || v === null || v === "") continue;
    if (allowed && !allowed.includes(String(v).trim())) {
      const ci = allowed.find(a => a.toLowerCase() === String(v).trim().toLowerCase());
      if (!ci) fail(`row ${i + 1}: '${col}' must be one of ${allowed.join(" | ")}, got '${v}'`, 2);
      v = ci;
    }
    if (col === "needs_approval") v = v === "yes";
    out[col] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

async function append(args) {
  const [table, cols] = tab(args[0]);
  if (!cols) fail("use 'tracker output' to save outputs", 2);
  if (args.length !== 2) fail("usage: tracker append <tab> '<json>'", 2);
  let data;
  try { data = JSON.parse(args[1]); } catch (e) { fail(`payload is not valid JSON: ${e.message}`, 2); }
  const rows = (Array.isArray(data) ? data : [data]).map((r, i) => validate(r, cols, i));
  if (!rows.length || rows.length > 50) fail("send 1-50 rows per call", 2);
  const saved = await db.insert(table, rows);
  print({ tab: args[0], rows_added: saved.length, ids: saved.map(r => r.id) });
}

async function output(args) {
  const external = args.includes("--external");
  const needsApproval = args.includes("--needs-approval");
  args = args.filter(a => a !== "--external" && a !== "--needs-approval");
  const file = opt(args, "--file");
  const [agent, kind, title] = args;
  if (!agent || !kind || !title || !file) fail('usage: tracker output <agent> <kind> "<title>" --file <path> [--external] [--needs-approval]', 2);
  let body;
  try { body = readFileSync(file, "utf8"); } catch (e) { fail(`cannot read ${file}: ${e.message}`, 2); }
  if (!body.trim()) fail("file is empty", 2);
  if (body.length > 200000) fail("file is larger than 200 KB", 2);
  const [saved] = await db.insert("agent_outputs", [{ agent, kind, title, body, audience: external ? "external" : "internal", needs_approval: needsApproval }]);
  print({ output_id: saved.id, agent, kind, title, saved_at_ist: `${istNow().date} ${istNow().time}` });
}

async function outputRead(args) {
  if (!/^[0-9a-f-]{36}$/.test(args[0] || "")) fail("usage: tracker output-read <id>", 2);
  const [row] = await db.get("agent_outputs", { select: "*", id: `eq.${args[0]}` });
  if (!row) fail("no such output", 2);
  console.log(`# ${row.title}\n(${row.agent} · ${row.kind} · ${row.created_at})\n\n${row.body}`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "tabs": console.log(Object.keys(TABS).join("\n")); break;
  case "columns": {
    const [, cols] = tab(rest[0]);
    if (!cols) { console.log("outputs: saved with 'tracker output'"); break; }
    for (const [c, a, r] of cols) console.log(`${c}\t${r ? "required" : "optional"}\t${a ? a.join("|") : ""}`);
    break;
  }
  case "read": await read(rest); break;
  case "append": await append(rest); break;
  case "output": await output(rest); break;
  case "output-read": await outputRead(rest); break;
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
    process.exit(cmd ? 2 : 0);
}
