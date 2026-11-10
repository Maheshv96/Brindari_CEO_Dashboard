#!/usr/bin/env node
/**
 * Read-only access to the dashboard's Supabase data, for Brindari agents.
 *
 *   npm run -s agent:read -- <table> [--limit N] [--select a,b,c] [--eq col=value]... [--order col[.desc]]
 *   npm run -s agent:read -- --tables
 *
 * Guarantees:
 *   - Only HTTP GET requests are ever sent (PostgREST GET = SELECT). There is no code path that writes.
 *   - Only tables in ALLOWED can be read.
 *   - The key is read from .env.local and never printed.
 *
 * Caveat: until a dedicated read-only Postgres role exists (see docs/agents/README.md),
 * this uses SUPABASE_SERVICE_ROLE_KEY, which bypasses row-level security. The read-only
 * guarantee therefore comes from this script, so agents may run ONLY this script, never
 * arbitrary code that could reuse the key.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ALLOWED = {
  leads:                   "Lead pipeline (dashboard)",
  buyers:                  "Buyer records (dashboard)",
  suppliers:               "Supplier records (dashboard)",
  supplier_quotes:         "Quotes received from suppliers",
  discovered_suppliers:    "Supplier discovery module results (status new/approved/rejected)",
  supplier_discovery_jobs: "Supplier discovery run history",
  orders:                  "Orders",
  order_items:             "Order line items",
  shipments:               "Shipments",
  invoices:                "Invoices (read only)",
  email_campaigns:         "Email campaigns",
  email_logs:              "Sent email log",
  fob_calculations:        "Saved FOB calculations",
  revenue:                 "Revenue records",
};
const MAX_LIMIT = 500;
const IDENT = /^[a-z_][a-z0-9_]*$/;

function fail(msg, code = 1) {
  process.stderr.write(`agent:read: ${msg}\n`);
  process.exit(code);
}

function loadEnv() {
  const candidates = [path.resolve(".env.local")];
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    candidates.push(path.join(path.dirname(common), ".env.local")); // main checkout when run from a worktree
  } catch { /* not a git checkout */ }
  const env = {};
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    break;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.AGENT_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || env.AGENT_SUPABASE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL and a key are required in .env.local");
  return { url: url.replace(/\/$/, ""), key };
}

function parseArgs(argv) {
  const out = { table: null, limit: 50, select: "*", eq: [], order: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tables") out.tables = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--select") out.select = argv[++i];
    else if (a === "--eq") out.eq.push(argv[++i]);
    else if (a === "--order") out.order = argv[++i];
    else if (a.startsWith("--")) fail(`unknown option ${a}`, 2);
    else if (!out.table) out.table = a;
    else fail(`unexpected argument ${a}`, 2);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.tables || !args.table) {
  for (const [t, d] of Object.entries(ALLOWED)) console.log(`${t}\t${d}`);
  process.exit(args.tables ? 0 : 2);
}
if (!(args.table in ALLOWED)) fail(`table '${args.table}' is not readable by agents. Allowed: ${Object.keys(ALLOWED).join(", ")}`, 2);
if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > MAX_LIMIT) fail(`--limit must be 1-${MAX_LIMIT}`, 2);
if (args.select !== "*" && !args.select.split(",").every(c => IDENT.test(c.trim()))) fail("--select takes comma-separated column names", 2);

const qs = new URLSearchParams({ select: args.select.replace(/\s/g, ""), limit: String(args.limit) });
for (const f of args.eq) {
  const i = f.indexOf("=");
  const col = f.slice(0, i);
  if (i < 1 || !IDENT.test(col)) fail(`--eq expects col=value, got '${f}'`, 2);
  qs.append(col, `eq.${f.slice(i + 1)}`);
}
if (args.order) {
  const [col, dir] = args.order.split(".");
  if (!IDENT.test(col) || (dir && !["asc", "desc"].includes(dir))) fail("--order expects col or col.desc", 2);
  qs.set("order", `${col}.${dir || "asc"}`);
}

const { url, key } = loadEnv();
const res = await fetch(`${url}/rest/v1/${args.table}?${qs}`, {
  method: "GET",
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
});
const body = await res.text();
if (!res.ok) fail(`HTTP ${res.status}: ${body.slice(0, 300)}`);
const rows = JSON.parse(body);
console.log(JSON.stringify({ table: args.table, count: rows.length, rows }, null, 1));
