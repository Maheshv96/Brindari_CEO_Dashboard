# Brindari agent system

Eleven Claude Code subagents, defined in `.claude/agents/`, all working from one brief.

| File | Purpose |
|---|---|
| [BRIEF.md](BRIEF.md) | The v4 brief: business facts, tracker, agents, Vista framework, plan, rules. Single source of truth. |
| [OPEN_ITEMS.md](OPEN_ITEMS.md) | `[CONFIRM]` items and conflicts between the brief and this repo. Agents treat everything here as unverified. |
| `outputs/<agent>/` | Longer agent outputs (opportunity cards, Vista candidate files, draft batches). |

## Agents

| Phase | Agent (call it by the name in `code`) | Does | Never |
|---|---|---|---|
| All | **Atlas [your chief of staff]** (`atlas`) | Digests, weekly review, approvals triage, conflicts | Contacts anyone |
| 1 | **Scout [your buyer researcher]** (`scout`) | Finds and verifies buyers | Contacts anyone |
| 1 | **Harvest [your supplier sourcing lead]** (`harvest`) | Supplier research, scorecard, quotes, samples | Agrees prices or terms |
| 1 | **Herald [your outreach writer]** (`herald`) | Drafts outreach for founder approval | Sends, negotiates |
| 1 | **Radar [your opportunity scout]** (`radar`) | Opportunity cards; passes products to Vista | Deep studies |
| 1 | **Vista [your diversification researcher]** (`vista`) | Stability screen and Gates 0–6 for new products | Commits to a product |
| 2 | **Quill [your website and listings writer]** (`quill`) | Website, product and IndiaMART copy | Edits the site |
| 2 | **Pulse [your social media manager]** (`pulse`) | Facebook and LinkedIn post drafts, KPI logging | Posts |
| 0/2 | **Compass [your compliance tracker]** (`compass`) | Registrations, certifications, HS code, duties | Files or signs |
| 3 | **Ledger [your orders and finance tracker]** (`ledger`) | Orders, P&L, cash, FOB maths | Invoices, moves money |
| 3 | **Courier [your logistics coordinator]** (`courier`) | Shipments and document checklist | Books or releases documents |

No agent has a tool that can send email, post, pay or file. Agents log to the shared tracker (BRIEF §5) with `agent:tracker`, and the read-capable agents (atlas, scout, harvest, vista, compass, ledger, courier) can read dashboard data with `agent:read`. Those two commands are the only shell commands agents may run; both are pre-approved in `.claude/settings.json`. New agent files load in a **new** Claude Code session.

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

## Schedules

Shown in the Claude desktop app sidebar under **Scheduled** (with run history and **Run now**). Runs happen only while the app is open; a missed run happens on next launch. All run from `/Users/mahesh/Brindari_CEO_Dashboard`.

| Agent | When (IST) | Status |
|---|---|---|
| Atlas [your chief of staff]: daily digest | Weekdays ~9 AM | Scheduled |
| Vista [your diversification researcher]: research step | Mondays ~9:30 AM | Scheduled |
| Scout [your buyer researcher]: verify 10 prospects | Tuesdays ~10 AM | Scheduled |
| Harvest [your supplier sourcing lead]: review 8 suppliers | Wednesdays ~10 AM | Scheduled |
| Radar [your opportunity scout]: opportunity scan | Thursdays ~10 AM | Scheduled |
| Compass [your compliance tracker]: compliance check | Fridays ~10 AM | Scheduled |
| Atlas [your chief of staff]: weekly review | Fridays ~5 PM | Scheduled |

Herald, Quill and Pulse produce drafts for review, so they run on request. Ledger and Courier wait for first orders.

**Agents writing to the CEO dashboard:** only Scout, and only to add VERIFIED prospects to Leads (`npm run -s agent:add-lead`). Insert only: status `new`, source `Scout (agent)`, evidence links in Notes, duplicates skipped, at most 10 per call. All other agents read the dashboard but never change it.

Other Brindari workbooks are readable (never writable) with `npm run -s agent:tracker -- read "<sheet>" --workbook <master|contacts|marketing|trademap|actionpack>`.

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
