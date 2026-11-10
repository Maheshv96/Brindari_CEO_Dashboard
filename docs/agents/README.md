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

The shared tracker is in Supabase (`agent_*` tables). The dashboard shows it at **/agents**.

| Command | Who | What |
|---|---|---|
| `npm run -s agent:tracker -- …` | all agents | `tabs`, `columns <tab>`, `read <tab>`, `append <tab> '<json>'`, `output …`, `output-read <id>`, `read "<sheet>" --workbook <name>`. Add-only. |
| `npm run -s agent:read -- <table> …` | atlas, scout, harvest, vista, compass, ledger, courier | Dashboard data, read only, fixed table list |
| `npm run -s agent:add-lead -- '<json>'` | scout | Insert VERIFIED prospects into Leads (status `new`, source `Scout (agent)`) |
| `npm run agent:excel -- export` | founders, on the Mac | Write the tracker into toolkit tabs 12–20 (backup first; refuses while the file is open) |
| `npm run agent:excel -- import-sources` | founders, on the Mac | Copy the research workbooks into Supabase for agents (re-run after editing them) |

`agent:excel` needs the Python environment once: `python3 -m venv scripts/agents/.venv && scripts/agents/.venv/bin/pip install openpyxl==3.1.5 certifi==2025.8.3`.

**Credentials.** Scripts read `NEXT_PUBLIC_SUPABASE_URL` and a key from the environment (cloud) or `.env.local` (Mac). They prefer `AGENT_SUPABASE_KEY`: a key for the `brindari_agent` database role, which can only read, add tracker rows, and add Scout leads (enforced by the database). Without it they fall back to `SUPABASE_SERVICE_ROLE_KEY`, with the same limits enforced by the scripts only.

## Schedules

Shown in the Claude desktop app sidebar under **Scheduled** (with run history and **Run now**). Runs happen only while the app is open; a missed run happens on next launch. All run from `/Users/mahesh/Brindari_CEO_Dashboard`.

| Time (IST) | Agent | Days | Each run |
|---|---|---|---|
| 9:00 AM | Scout [your buyer researcher] | Mon–Sat | Verify 5 prospects; add VERIFIED ones to dashboard Leads |
| 10:00 AM | Harvest [your supplier sourcing lead] | Mon–Sat | Review and score 4 suppliers |
| 11:00 AM | Compass [your compliance tracker] | Mon–Sat until 24 Nov 2026, then Mon & Thu | 1–2 compliance checks |
| 12:00 PM | Herald [your outreach writer] | Mon–Sat | Draft emails for up to 5 verified prospects, into Approvals (never sends) |
| 2:00 PM | Vista [your diversification researcher] | Mon & Thu | One research step |
| 3:00 PM | Radar [your opportunity scout] | Tue & Fri | Market and policy scan |
| 7:00 PM | Atlas [your chief of staff] | Mon–Fri | Daily update: today by agent, what needs you, tomorrow's top 3 |
| 7:00 PM | Atlas [your chief of staff] | Sat | Weekly review (replaces that day's update) |

**Limit:** these are local scheduled tasks. They run only while this Mac is on, awake and the Claude app is open; a missed run happens on next launch. See OPEN_ITEMS A18 for the always-on (cloud) plan.

Quill and Pulse produce drafts for review, so they run on request. Ledger and Courier wait for first orders.

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
