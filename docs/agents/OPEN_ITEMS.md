# Open items and conflicts

Every item here is **unverified** for agents: they may mention it internally as an open question, never state it as fact externally. When an item is settled, log it in the tracker's Decisions tab, update [BRIEF.md](BRIEF.md), and delete it here.

Last updated: 2026-11-10.

## A. Decisions the founders need to make (from the brief)

| # | Item | Options on record | Who decides |
|---|---|---|---|
| A1 | Decision rights: what goes to Punam, what to Mahesh, who approves spending | — | Punam + Mahesh |
| A2 | Marketing owner | not recorded | |
| A3 | Radar owner | not recorded | |
| A4 | Vista owner | not recorded | |
| A5 | Legal entity | sole proprietorship / Pvt Ltd | |
| A6 | Trading name in external copy | "Brindari Global" (dashboard) / "Brindari" (early plan) | |
| A7 | HS code | 12119029 (master) / 1211.90.99 / 0712.90.90 (early plan) | Compass checks, founders confirm |
| A8 | Sourcing region | Maharashtra (dashboard) / TN, AP, KA (early plan) | |
| A9 | Buyer count | 22 / 22 + 4 Malaysia | Scout recounts |
| A10 | Supplier discovery module status | see C2 | |
| A11 | LinkedIn setup (scheduled 15 Sep 2026) | done / not done | |
| A12 | Tracker location (`TRACKER_PATH` in BRIEF §0) | — | |

## B. Facts to verify (Compass)

- Registrations: IEC, GST, AD Code, ICEGATE, APEDA RCMC, FSSAI, MSME — status unknown.
- Certifications: USDA Organic, EU Organic, Halal, ISO 22000 — status unknown. Halal body, cost (₹15k–50k) and timeline (4–8 weeks) are unsourced estimates.
- Duty: 0% into UAE under India-UAE CEPA; 0% into Malaysia under AIFTA — unverified for the confirmed HS code.

## C. Conflicts between the brief and the dashboard repo (Phase 0 audit, 2026-11-10)

Found by reading this repository (`main` at b0d9fb9). No code was changed.

| # | Brief says | Repo shows | Risk |
|---|---|---|---|
| C1 | Social Marketing (`/social`) is live with Facebook KPIs, 19-group tracker, post calendar | Removed on 13 Sep 2026 in commit b680965 ("revert: remove all Social Marketing work"). No `/social` page or `/api/social` routes on `main`. | Brief §3 is out of date; check whether the live Vercel deploy still serves it. |
| C2 | Supplier discovery planned in Python 3.11 (httpx, BS4, lxml, Playwright), sources IndiaMART / TradeIndia / APEDA | Already built in TypeScript: `src/lib/supplier-scraper.ts` (IndiaMART export portal, APEDA, Google Maps, company websites), `/suppliers/discover`, `api/suppliers/discover*`, migration `20260519000001_supplier_discovery.sql`. No TradeIndia source. | Decide whether the Python plan is dropped. Building a second module would duplicate work. |
| C3 | Certifications are unverified; remove unverified claims | `CONTEXT.md` states "HACCP · FSSAI · APEDA · NABL" as facts. `src/lib/email-html.ts` `CERT_DESCRIPTIONS` can render HACCP, NABL, Organic, ISO 22000, Halal, Kosher, Non-GMO into buyer emails. | Rule 8: unverified certification claims can reach buyers. HACCP, NABL, Kosher and Non-GMO are not in the brief at all. |
| C4 | No unverified figures in external output | `MARKET_PRICING` in `src/lib/email-html.ts` hard-codes FOB prices (USD 4.20–4.80/kg) and MOQs (300–500 kg) per country, used in outreach emails. No source recorded. | Prices are quoted externally without a logged decision. Rule 1 (quoting a price needs approval). |
| C5 | Origin is an open item | `ORIGIN_PARA` and AI prompts in `api/email-agent/*` hard-code Maharashtra and claim "full traceability from farm to shipment". | Fine if A8 = Maharashtra and traceability can be evidenced; otherwise remove. |
| C6 | Brand voice: no hype | Bulk-campaign subject line 1 is "Premium Organic Moringa from India …", while the prompt in the same file forbids "premium". | Minor; inconsistent voice in the first email a buyer sees. |
| C7 | Website is Next.js + Supabase + Vercel | `CONTEXT.md` says brindari.com is a separate static site on Hostinger. | Quill and anyone editing the site need the right answer. |
| C8 | Target markets: USA, Germany, UK, Australia, UAE, Malaysia, Philippines | `MARKET_PRICING` covers Canada, France, Netherlands, Saudi Arabia, Japan, South Korea, but not Malaysia or the Philippines. | Malaysia and Philippines emails get no market price row. |
| C9 | Repo branch: `chore/prod-config-updates` | Production merges go to `main` via PRs from that branch. | Note only. |

Suggested next step for C3–C6: a small, surgical change to the email module (rule 6), only after A6–A8 and the B items are settled, so it changes once.
