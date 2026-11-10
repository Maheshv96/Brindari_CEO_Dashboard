# Open items and conflicts

Every item still open here is **unverified** for agents: they may mention it internally as an open question, never state it as fact externally. When an item is settled, log it in the tracker's Decisions tab, update [BRIEF.md](BRIEF.md), and move it to "Settled" below.

Last updated: 2026-11-10.

## A. Founder decisions

### Settled 2026-11-10 (answers from Mahesh; log each in the Decisions tab)

| # | Item | Decision |
|---|---|---|
| A1 | Decision rights | Everything goes to Atlas (chief of staff) first. Atlas reviews and informs both Mahesh and Punam, who decide. |
| A2 | Marketing owner | Atlas reviews, then informs Mahesh and Punam. |
| A3 | Radar reviewer | Atlas reviews, then informs Mahesh and Punam. |
| A4 | Vista reviewer | Atlas reviews, then informs Mahesh and Punam. |
| A5 | Legal entity | Sole proprietorship for now; move to Pvt Ltd under discussion. |
| A6 | Trading name | Brindari Global. |
| A7 | HS code | 12119029 (Compass still checks it against the official schedule). |
| A8 | Office and sourcing | Office in Maharashtra. Moringa sourced from across India, mainly Tamil Nadu, Andhra Pradesh and Karnataka. |
| A9 | Buyers | None yet. The 22 + 4 in the master are prospects. |
| A10 | Supplier discovery | Built in TypeScript in the dashboard. No Python version. Harvest and Scout judge which suppliers and buyers are high-rated and trustworthy. |
| A12 | Tracker location | `03_Brindari_Operations_Toolkit.xlsx` (path in BRIEF §0). |

### Still open

| # | Item | Status | Who |
|---|---|---|---|
| A11 | LinkedIn setup (scheduled 15 Sep 2026) | A web search on 2026-11-10 found no public Brindari Global LinkedIn page. Someone signed in to LinkedIn needs to check for a company page and the founders' profiles. | Mahesh or Punam |
| A12a | Missing tracker tabs | The toolkit has no Activity log, Tasks, Approvals, Decisions, Diversification pipeline, Compliance or Marketing KPIs tabs. They need adding to the same workbook. | Mahesh, or Claude on request |
| A13 | Supplier discovery on Vercel | The module launches a full browser inside one API request. That is expected to fail on Vercel, so it probably works only when the dashboard runs locally. Not tested yet. | To test locally |

## B. Facts to verify (Compass)

- Registrations: IEC, GST, AD Code, ICEGATE, APEDA RCMC, FSSAI, MSME. Status unknown. As a sole proprietorship, registrations are in the proprietor's name and need re-doing on a move to Pvt Ltd; Compass should note which ones.
- Certifications: USDA Organic, EU Organic, Halal, ISO 22000. Status unknown. The Halal body, cost (₹15k–50k) and timeline (4–8 weeks) are unsourced estimates.
- Duty: 0% into the UAE under the India-UAE CEPA and 0% into Malaysia under AIFTA are unverified for HS 12119029.

## C. Conflicts between decisions and the dashboard code (Phase 0 audit, 2026-11-10)

No code has been changed yet. These are now **confirmed wrong** against the A-decisions, not just unverified.

| # | Where | Problem | Rule broken |
|---|---|---|---|
| C1 | `src/lib/email-html.ts` `ORIGIN_PARA`, and AI prompts in `src/app/api/email-agent/generate` and `bulk-campaign` | Tells buyers the moringa is "Sourced from Maharashtra". Wrong per A8. Also claims "full traceability from farm to shipment", which has no evidence yet. | 3, 8 |
| C2 | `CONTEXT.md` | Says "Origin: Maharashtra (not Tamil Nadu / Andhra Pradesh)". This is the reverse of A8 and will mislead future sessions. | 3 |
| C3 | `email-html.ts` `CERT_DESCRIPTIONS`; `CONTEXT.md` | Can show HACCP, NABL, Organic, ISO 22000, Halal, Kosher and Non-GMO in buyer emails. None is verified (section B). | 8 |
| C4 | `email-html.ts` `MARKET_PRICING` | Fixed FOB prices (USD 4.20–4.80/kg) and MOQs per country with no source or approval. No rows for Malaysia or the Philippines. | 1, 8 |
| C5 | `bulk-campaign` subject line 1 | Says "Premium Organic Moringa…", against the brand voice and the same file's own prompt. | Brand voice |
| C6 | `src/app/api/email-agent/generate` prompt | Check its wording against A9 ("new exporter building its network" is fine; any "our buyers / clients" wording is not). | 8 |
| C7 | `CONTEXT.md` vs brief §3 | Website described as a static Hostinger site vs Next.js/Supabase/Vercel. A local copy exists at `/Users/mahesh/Documents/Claude/Projects/Brindari.com/website`. | Audit needed |

**Next development step:** one surgical PR to the email module and `CONTEXT.md` fixing C1, C2, C5 and C6 now. For C3 and C4, either remove the unverified certifications and prices or put them behind an explicit founder-approved list, since they wait on Compass (section B) and a pricing decision.
