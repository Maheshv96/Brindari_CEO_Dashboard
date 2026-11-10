// Shared helpers for Brindari agent scripts. No dependencies (Node 18+ fetch).
//
// Credentials, in order:
//   1. process.env (cloud routines: set in the cloud environment's settings)
//   2. .env.local in this checkout, or in the main checkout when run from a git worktree
// Key preference: AGENT_SUPABASE_KEY (limited brindari_agent role) > SUPABASE_SERVICE_ROLE_KEY.
// Only GET and POST helpers exist: these scripts never update or delete.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function fail(prefix, msg, code = 1) {
  process.stderr.write(`${prefix}: ${msg}\n`);
  process.exit(code);
}

function fileEnv() {
  const files = [path.resolve(".env.local")];
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    files.push(path.join(path.dirname(common), ".env.local"));
  } catch { /* not a git checkout */ }
  for (const f of files) {
    if (!existsSync(f)) continue;
    const env = {};
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  }
  return {};
}

export function supabase(prefix) {
  const env = { ...fileEnv(), ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)) };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.AGENT_SUPABASE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail(prefix, "set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and AGENT_SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  const base = url.replace(/\/$/, "") + "/rest/v1/";
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };

  async function handle(res, what) {
    const text = await res.text();
    if (!res.ok) fail(prefix, `${what} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    async get(table, params = {}) {
      const qs = new URLSearchParams(params);
      return handle(await fetch(`${base}${table}?${qs}`, { method: "GET", headers }), `read ${table}`);
    },
    async insert(table, rows) {
      return handle(await fetch(`${base}${table}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(rows),
      }), `insert into ${table}`);
    },
  };
}

export const IDENT = /^[a-z_][a-z0-9_]*$/;

export function istNow() {
  const d = new Date(Date.now() + 5.5 * 3600e3);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}
