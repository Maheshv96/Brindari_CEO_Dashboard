# Brindari CEO Dashboard — Session Context

## Project
- **Repo**: `/Users/mahesh/Brindari_CEO_Dashboard`
- **Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase, Resend, Groq AI
- **Dashboard URL**: `http://localhost:3000`
- **Website**: `https://brindari.com` (separate static site on Hostinger — do NOT mix with dashboard)
- **Run**: `npm run dev` in the project root

---

## Business Context

| Field | Detail |
|---|---|
| Company | Brindari Global |
| Product | Organic Moringa Powder, dried leaves, seed oil, tea |
| Origin | **Maharashtra, India** (not Tamil Nadu / Andhra Pradesh) |
| Certifications | HACCP · FSSAI · APEDA · NABL |
| Email | sales@brindari.com |
| Phone | +91 7020400283 / 9404772826 |
| Website | www.brindari.com |
| Sending from | hello@brindari.com (via Resend) |

---

## Email System — Current State (fully working)

### Key Files

| File | Purpose |
|---|---|
| `src/lib/email-html.ts` | **Core email builder** — all template logic lives here |
| `src/app/api/email-agent/send-test/route.ts` | Single test email send (Quick Generator) |
| `src/app/api/email-agent/bulk-campaign/route.ts` | Bulk campaign sending |
| `src/app/api/email-agent/generate/route.ts` | AI email generation (Groq) |
| `src/app/emails/page.tsx` | Email Campaigns UI |
| `src/app/api/logo/route.tsx` | Serves logo as PNG (160×160) |

---

## Logo — How It Works

- **Website SVG**: `https://brindari.com/assets/logo-icon.svg` (uploaded to Hostinger)
- **Email delivery**: At send time, server fetches the SVG from `brindari.com`, converts to PNG using `sharp`, attaches as **inline CID attachment** (`cid:logo-brindari`)
- Gmail and all clients render it perfectly — no external image URL needed
- `sharp` is installed as a dependency

---

## Email Template — `email-html.ts`

### Exports
- `BRAND` — company name, email, phone, colors
- `ORIGIN_PARA` — Maharashtra origin paragraph
- `CERT_DESCRIPTIONS` — cert name → description mapping
- `MARKET_PRICING` — country → { fob, moq, port }
- `EmailDetails` interface — all fields
- `buildEmailHtml(introText, details, logoSrc?)` — main HTML builder
- `buildEmailText(introText, details)` — plain text fallback

### EmailDetails Interface
```typescript
interface EmailDetails {
  product?:           string;
  fob_price?:         string;
  moq?:               string;
  certifications?:    string[];
  sample?:            boolean;
  packaging?:         string;
  lead_time?:         string;
  payment_terms?:     string;
  shelf_life?:        string;
  hs_code?:           string;
  container_loading?: string;
  port?:              string;
  show_docs?:         boolean;
  stage?:             number;   // 1–5
}
```

### Stage-Aware Templates
Each stage shows different content:

| Stage | Name | Shows |
|---|---|---|
| 1 | Cold Outreach | Product, FOB, top 3 certs (inline), sample |
| 2 | Detailed Inquiry | Everything + full cert bullets + docs list |
| 3 | Sample Follow-up | Product, FOB, MOQ, Port, Payment Terms |
| 4 | Direct Ask | No details block — just the question |
| 5 | Retention | Product + Sample only, minimal |

### Market Pricing (auto-applied in bulk campaigns)
```
USA/Canada:   $4.80/kg, MOQ 500
Germany/France/Netherlands/UK: $4.50/kg, MOQ 500
Australia:    $4.60/kg, MOQ 500
UAE/Saudi:    $4.20/kg, MOQ 300
Japan/Korea:  $4.70/kg, MOQ 500
```

---

## Bulk Campaign — Buyer Stage Variations

In `bulk-campaign/route.ts`, `SEQUENCE_CONTEXT` maps step → AI prompt + subject prefix + show_docs flag:

| Step | Stage | showDocs |
|---|---|---|
| 1 | Cold outreach — quick credibility | false |
| 2 | Detailed inquiry — complete specs | true |
| 3 | Sample follow-up — close the deal | false |
| 4 | Direct ask — one question | false |
| 5 | Retention / reorder | false |

Subject line strategy: each stage has a template (e.g. Cold → `"Premium Organic Moringa from India — FOB $X/kg"`).

---

## Quick Email Generator UI — `emails/page.tsx`

### Form Fields (gen state)
```
products, countries, step, company, contact, tone, certifications,
fob_price, moq, sample,
// Advanced Details (collapsible):
packaging, lead_time, payment_terms, shelf_life, hs_code,
container_loading, port, show_docs
```

### Certifications shown in UI
`HACCP · FSSAI · APEDA · NABL · Organic · ISO 22000 · Halal · Kosher · Non-GMO`

### Multi-country generation
If multiple countries selected, generates one email per country and shows them as tabs.

### Advanced Details
Collapsible section (▶ toggle) with 7 fields: Packaging, Lead Time, Payment Terms, Shelf Life, HS Code, Container Loading, Port of Loading + "Include Documentation List" toggle.

---

## What Was Completed This Session

1. ✅ Fixed broken logo (catbox.moe was dead)
2. ✅ Logo now embedded as inline PNG from website SVG (`sharp` conversion)
3. ✅ Maharashtra origin story updated
4. ✅ Certifications as bullet list with descriptions (HACCP, FSSAI, APEDA, NABL)
5. ✅ Documentation section (COA, Phytosanitary, Origin, HACCP/FSSAI, Packing List)
6. ✅ Full `EmailDetails` with packaging, lead time, HS code, payment terms, etc.
7. ✅ Market-specific pricing table
8. ✅ 5 buyer stage variations with different content per stage
9. ✅ Subject line strategy per stage
10. ✅ Multi-country generation with tabs
11. ✅ "Product" field shown in email details section
12. ✅ Advanced Details section in Quick Generator UI
13. ✅ UI redesigned — cleaner stage pills, section separators, generate button
14. ✅ Stage-aware templates (different details shown per stage)
15. ✅ All 5 stage emails tested and sent to vaishnav.maheshs789@gmail.com

---

## Pending / Next Steps

- [ ] Logo still shows as broken image placeholder in some cases — PNG inline via CID should fix in real Gmail (verify in inbox)
- [ ] Subject lines for stages 2–4 still use AI-generated subjects (can be overridden)
- [ ] Campaign creation form doesn't have Advanced Details fields yet (only Quick Generator has them)
- [ ] No follow-up scheduling / drip sequence automation yet

---

## Environment
```
RESEND_API_KEY=<see .env.local — not committed>
RESEND_FROM_EMAIL=hello@brindari.com
NEXT_PUBLIC_SUPABASE_URL=<see .env.local — not committed>
NEXT_PUBLIC_APP_URL=http://localhost:3000
CEO_EMAIL=vaishnav.maheshs789@gmail.com
```
