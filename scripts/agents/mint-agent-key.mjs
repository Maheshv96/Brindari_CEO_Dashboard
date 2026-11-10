#!/usr/bin/env node
/**
 * Founders run this once on the Mac (not agents):  npm run agent:mint-key
 *
 * Creates AGENT_SUPABASE_KEY: a signed key for the limited `brindari_agent` database role
 * (read business tables, add tracker rows, add Scout leads; no edits, no deletes).
 *
 * Needs SUPABASE_JWT_SECRET in .env.local (Supabase dashboard → Project Settings → API →
 * JWT Settings → "JWT Secret"; legacy HS256 secret). The key is written into .env.local as
 * AGENT_SUPABASE_KEY and is NOT printed. Copy it from .env.local into the cloud
 * environment's variables yourself. Valid for 1 year; re-run to rotate.
 */
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const file = path.resolve(".env.local");
if (!existsSync(file)) { console.error("mint-key: run this from the main checkout, where .env.local lives"); process.exit(1); }
const text = readFileSync(file, "utf8");
const secret = (text.match(/^\s*SUPABASE_JWT_SECRET\s*=\s*(.*)\s*$/m) || [])[1]?.replace(/^["']|["']$/g, "");
if (!secret) { console.error("mint-key: add SUPABASE_JWT_SECRET=<your project's JWT secret> to .env.local first"); process.exit(1); }

const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ role: "brindari_agent", iss: "supabase", iat: now, exp: now + 365 * 24 * 3600 });
const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
const key = `${head}.${body}.${sig}`;

const next = /^\s*AGENT_SUPABASE_KEY\s*=.*$/m.test(text)
  ? text.replace(/^\s*AGENT_SUPABASE_KEY\s*=.*$/m, `AGENT_SUPABASE_KEY=${key}`)
  : text.replace(/\n?$/, `\nAGENT_SUPABASE_KEY=${key}\n`);
writeFileSync(file, next);
console.log(`mint-key: AGENT_SUPABASE_KEY written to .env.local (expires ${new Date((now + 365 * 24 * 3600) * 1000).toISOString().slice(0, 10)}). Not printed.`);
