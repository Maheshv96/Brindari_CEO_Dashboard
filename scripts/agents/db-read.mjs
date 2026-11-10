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
 * Key: AGENT_SUPABASE_KEY (brindari_agent role: read-only on these tables at database level)
 * if set, else SUPABASE_SERVICE_ROLE_KEY (read-only enforced by this script). See lib.mjs.
 */
import { supabase } from "./lib.mjs";

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

const db = supabase("agent:read");
const rows = await db.get(args.table, Object.fromEntries(qs));
console.log(JSON.stringify({ table: args.table, count: rows.length, rows }, null, 1));
