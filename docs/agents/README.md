# Brindari agent system

Eleven Claude Code subagents, defined in `.claude/agents/`, all working from one brief.

| File | Purpose |
|---|---|
| [BRIEF.md](BRIEF.md) | The v4 brief: business facts, tracker, agents, Vista framework, plan, rules. Single source of truth. |
| [OPEN_ITEMS.md](OPEN_ITEMS.md) | `[CONFIRM]` items and conflicts between the brief and this repo. Agents treat everything here as unverified. |
| `outputs/<agent>/` | Longer agent outputs (opportunity cards, Vista candidate files, draft batches). |

## Agents

| Phase | Agent | Does | Never |
|---|---|---|---|
| All | **atlas** | Digests, weekly review, approvals triage, conflicts | Contacts anyone |
| 1 | **scout** | Finds and verifies buyers | Contacts anyone |
| 1 | **harvest** | Supplier research, scorecard, quotes, samples | Agrees prices or terms |
| 1 | **herald** | Drafts outreach for founder approval | Sends, negotiates |
| 1 | **radar** | Opportunity cards; passes products to Vista | Deep studies |
| 1 | **vista** | Stability screen and Gates 0–6 for new products | Commits to a product |
| 2 | **quill** | Website, product and IndiaMART copy | Edits the site |
| 2 | **pulse** | Facebook and LinkedIn post drafts, KPI logging | Posts |
| 0/2 | **compass** | Registrations, certifications, HS code, duties | Files or signs |
| 3 | **ledger** | Orders, P&L, cash, FOB maths | Invoices, moves money |
| 3 | **courier** | Shipments and document checklist | Books or releases documents |

No agent has a tool that can send email, post, pay or file. Agents log to the shared tracker (BRIEF §5) with `agent:tracker`. Until they are granted permission to run it (OPEN_ITEMS A14), they print a **Tracker rows** block and the main session appends it.

## Tools

Two commands give agents (and you) access to data. Both are in `scripts/agents/`.

**Tracker** (`03_Brindari_Operations_Toolkit.xlsx`, path in BRIEF §0)

```bash
npm run -s agent:tracker -- tabs
```
```bash
npm run -s agent:tracker -- columns approvals
```
```bash
npm run -s agent:tracker -- read activity --last 20
```
```bash
npm run -s agent:tracker -- append activity '{"actor":"Scout","action":"verified buyer","item":"Example GmbH","status":"done","needs_approval":"no","source":"https://example.de"}'
```

- Append only: it never edits or deletes rows.
- Checks each field and its allowed values.
- Refuses to write while the workbook is open in a spreadsheet app or has a fresh lock file.
- Saves a backup to `Brindari.com/backups/` before every write and keeps the newest 30.
- Formula cells survive, but their cached values are recalculated when the file is next opened in Excel or LibreOffice.

First-time setup on a new machine (the Python environment is not committed):

```bash
python3 -m venv scripts/agents/.venv && scripts/agents/.venv/bin/pip install openpyxl==3.1.5
```

**Dashboard data, read only** (Supabase)

```bash
npm run -s agent:read -- --tables
```
```bash
npm run -s agent:read -- discovered_suppliers --select company_name,state,total_score,status --order total_score.desc --limit 20
```

- Sends HTTP GET only, to a fixed list of tables. The key is never printed.
- Reads `.env.local` from this checkout, or from the main checkout when run in a worktree.
- It currently uses `SUPABASE_SERVICE_ROLE_KEY`, so read-only is enforced by the script, not by the database. For database-level read-only, create the role below in the Supabase SQL editor, mint a JWT for it with your project's JWT secret, and put it in `.env.local` as `AGENT_SUPABASE_KEY`. The script prefers that key when set.

```sql
create role agent_reader nologin;
grant usage on schema public to agent_reader;
grant select on leads, buyers, suppliers, supplier_quotes, discovered_suppliers,
  supplier_discovery_jobs, orders, order_items, shipments, invoices,
  email_campaigns, email_logs, fob_calculations, revenue to agent_reader;
grant agent_reader to authenticator;
-- RLS: add a "for select to agent_reader using (true)" policy on each table above.
```

## Running one

In Claude Code, from this repo:

- "Use the compass agent to build the Phase 0 registration and certification status table."
- "Use the vista agent to run the stability screen on makhana, dried onion, dried tomato and dried capsicum."
- "Use the atlas agent to write today's digest."

## Suggested first runs (Phase 0)

1. Founders settle section A of OPEN_ITEMS, especially A6–A8 and A12.
2. **compass**: status table for every registration and certification.
3. **scout**: recount and dedupe the buyer list (A9).
4. **vista**: stability screen on the four starting candidates.
