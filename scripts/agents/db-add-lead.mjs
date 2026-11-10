#!/usr/bin/env node
/**
 * Insert-only: Scout adds VERIFIED prospects to the dashboard's `leads` table.
 *
 *   npm run -s agent:add-lead -- '<json object or array>' [--dry-run]
 *
 * Each lead: {
 *   "company": "…",            required
 *   "contact_name": "…",       required (use the role, e.g. "Head of Procurement", if no name is public)
 *   "country": "…",            required
 *   "evidence": "https://…",   required, one or more URLs separated by spaces
 *   "verification": "VERIFIED" required; PARTIAL / REJECTED leads are refused (keep them in the Excel Lead CRM)
 *   "email", "phone", "product_interest", "lead_score" (0-100), "notes"   optional
 * }
 *
 * Guarantees (approved by Mahesh, 2026-11-10: "Scout only"):
 *   - Only INSERTs into `leads`. No update, no delete, no other table.
 *   - status is always "new"; source is always "Scout (agent)"; no deal value.
 *   - Skips a lead whose company + country already exists (case-insensitive).
 *   - At most 10 leads per call. Never prints the key.
 */
import { supabase, istNow } from "./lib.mjs";

const MAX_PER_CALL = 10;
const ALLOWED = new Set(["company", "contact_name", "country", "evidence", "verification", "email", "phone", "product_interest", "lead_score", "notes"]);
const IST_DATE = istNow().date;

function fail(msg, code = 1) { process.stderr.write(`agent:add-lead: ${msg}\n`); process.exit(code); }

function str(v, max) {
  if (v == null) return null;
  if (typeof v !== "string" && typeof v !== "number") fail(`expected text, got ${JSON.stringify(v)}`, 2);
  return String(v).trim().slice(0, max);
}

function toRow(lead, i) {
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) fail(`lead ${i + 1} is not an object`, 2);
  const bad = Object.keys(lead).filter(k => !ALLOWED.has(k));
  if (bad.length) fail(`lead ${i + 1}: unknown field(s) ${bad.join(", ")}. Allowed: ${[...ALLOWED].join(", ")}`, 2);
  for (const k of ["company", "contact_name", "country", "evidence", "verification"]) {
    if (!lead[k] || String(lead[k]).trim() === "") fail(`lead ${i + 1}: '${k}' is required`, 2);
  }
  if (String(lead.verification).toUpperCase() !== "VERIFIED") fail(`lead ${i + 1} (${lead.company}): only VERIFIED prospects go to the dashboard; keep ${lead.verification} ones in the Excel Lead CRM`, 2);
  const urls = String(lead.evidence).split(/\s+/).filter(Boolean);
  if (!urls.every(u => /^https?:\/\/\S+$/.test(u))) fail(`lead ${i + 1}: 'evidence' must be http(s) URLs`, 2);
  let score = null;
  if (lead.lead_score != null && lead.lead_score !== "") {
    score = Number(lead.lead_score);
    if (!Number.isInteger(score) || score < 0 || score > 100) fail(`lead ${i + 1}: lead_score must be an integer 0-100`, 2);
  }
  const email = str(lead.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`lead ${i + 1}: email looks invalid`, 2);
  const extra = str(lead.notes, 1500);
  return {
    company:          str(lead.company, 200),
    contact_name:     str(lead.contact_name, 200),
    country:          str(lead.country, 100),
    email:            email || null,
    phone:            str(lead.phone, 60) || null,
    product_interest: str(lead.product_interest, 300) || null,
    lead_score:       score,
    status:           "new",
    source:           "Scout (agent)",
    notes:            `[Scout VERIFIED ${IST_DATE}] Prospect, not a customer. Evidence: ${urls.join(" ")}${extra ? `\n${extra}` : ""}`,
  };
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const payload = argv.filter(a => a !== "--dry-run");
if (payload.length !== 1) fail("usage: agent:add-lead -- '<json object or array>' [--dry-run]", 2);
let data;
try { data = JSON.parse(payload[0]); } catch (e) { fail(`payload is not valid JSON: ${e.message}`, 2); }
const leads = Array.isArray(data) ? data : [data];
if (leads.length === 0 || leads.length > MAX_PER_CALL) fail(`send 1-${MAX_PER_CALL} leads per call`, 2);
const rows = leads.map(toRow);

const db = supabase("agent:add-lead");
// Duplicate check: compare normalised company + country in code (no pattern matching on the server).
const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const known = await db.get("leads", { select: "id,company,country,status", limit: "10000" });

const result = { added: [], skipped_duplicates: [], dry_run: dryRun };
for (const row of rows) {
  const existing = known.filter(k => norm(k.company) === norm(row.company) && norm(k.country) === norm(row.country));
  if (existing.length) { result.skipped_duplicates.push({ company: row.company, country: row.country, existing_status: existing[0].status }); continue; }
  if (dryRun) { result.added.push({ would_insert: row }); continue; }
  const [saved] = await db.insert("leads", [row]);
  known.push(saved); // also catches duplicates within the same call
  result.added.push({ id: saved.id, company: saved.company, country: saved.country, status: saved.status });
}
console.log(JSON.stringify(result, null, 1));
