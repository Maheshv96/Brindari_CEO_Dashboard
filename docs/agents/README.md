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

No agent has a tool that can send email, post, pay or file. Agents end each run with a **Tracker rows** block for the shared tracker (BRIEF §5); once `TRACKER_PATH` is set they can be pointed at it.

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
