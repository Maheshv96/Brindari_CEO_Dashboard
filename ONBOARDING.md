# Brindari CEO Dashboard — Project Context

## What This Is
A full-stack CEO dashboard for **Brindari Global**, an organic moringa export business (India → Germany, UAE, UK, USA, Australia). Built with Next.js 14, Tailwind CSS, Supabase, Groq AI (free), and Resend email.

**Local dev:** `http://localhost:3000`  
**Project path:** `/Users/mahesh/Brindari_CEO_Dashboard`

---

## Tech Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router (`src/` directory) |
| Styling | Tailwind CSS v3 (NOT v4) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| AI | Groq SDK — `llama-3.1-8b-instant` (FREE, 14,400 req/day) |
| Email delivery | Resend — `hello@brindari.com` |
| UI components | Radix UI (NOT @base-ui/react which is v4 only) |

---

## Brand
- **Company:** Brindari Global
- **Tagline:** Pure. Organic. Global.
- **Website:** https://www.brindari.com
- **Sales email:** sales@brindari.com
- **Phone:** +91 7020400283 / 9404772826
- **Colors:** Teal `#0F6E56`, Deep teal `#0A5040`, Sage `#7BA88A`
- **Logo icon:** fetched live from `https://brindari.com/assets/logo-icon.svg`, converted to PNG via `sharp`, embedded as inline CID attachment in emails (catbox.moe URL is retired)
- **Full logo on website:** `https://www.brindari.com/assets/logo.svg`

---

## Environment Variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=<see .env.local — not committed>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local — not committed>
SUPABASE_SERVICE_ROLE_KEY=<see .env.local — not committed>
RESEND_API_KEY=<see .env.local — not committed>
RESEND_FROM_EMAIL=hello@brindari.com
RESEND_FROM_NAME=Brindari Global
CEO_EMAIL=hello@brindari.com
GROQ_API_KEY=<see .env.local — not committed>
NEXT_PUBLIC_USD_TO_INR=83.5
NEXT_PUBLIC_APP_URL=http://localhost:3000
EMAIL_LOGO_URL=https://brindari.com/assets/logo-icon.svg
```

---

## Pages Built (All Working)
| Page | Route | Status |
|---|---|---|
| Dashboard overview | `/` | ✅ |
| Lead Tracker | `/leads` | ✅ Table + Kanban view |
| Buyers | `/buyers` | ✅ Buyer portal invite |
| Email Campaigns | `/emails` | ✅ AI generator + campaigns |
| Orders | `/orders` | ✅ Pipeline status |
| Shipments | `/shipments` | ✅ Tracking |
| Documents | `/documents` | ✅ Upload + share |
| Invoices | `/invoices` | ✅ PDF generation |
| Revenue | `/revenue` | ✅ Charts + targets |
| FOB Calculator | `/calculator` | ✅ |
| Suppliers | `/suppliers` | ✅ Compare + quotes |
| Lead Import | `/leads/import` | ✅ Bulk + manual |
| Supplier Finder | `/suppliers/find` | ✅ Source databases |

---

## Key Files
```
src/
├── app/
│   ├── page.tsx                          # Dashboard overview
│   ├── emails/page.tsx                   # Email Campaigns + Quick Generator
│   ├── leads/page.tsx                    # Lead tracker (table + kanban)
│   ├── orders/page.tsx                   # Order pipeline
│   ├── calculator/page.tsx               # FOB cost calculator
│   └── api/
│       ├── email-agent/generate/         # AI email generation (Groq)
│       ├── email-agent/send-test/        # Test email sender
│       ├── email-agent/bulk-campaign/    # Campaign bulk send
│       ├── email-agent/classify/         # AI reply classifier
│       ├── logo/route.tsx                # Logo PNG API (next/og)
│       └── invoices/generate-pdf/        # PDF generation
├── components/
│   ├── Sidebar.tsx                       # Navigation + live badges
│   ├── orders/OrderModal.tsx             # Order form with tooltips
│   └── ui/
│       ├── MultiSelect.tsx               # Multi-select dropdown
│       ├── Tip.tsx                       # Tooltip component + TIPS dictionary
│       └── CountrySelect.tsx             # Country dropdown
├── lib/
│   ├── ai.ts                             # callAI() — auto-selects Groq/Anthropic
│   ├── email-html.ts                     # Shared email HTML builder (IMPORTANT)
│   ├── supabase.ts                       # Supabase client
│   └── utils.ts                         # PRODUCTS, COUNTRIES, formatUSD, cn
public/
├── logo-icon.svg                         # Moringa leaf icon (no text)
├── logo-green.svg                        # Full brand logo green
└── logo-gold.svg                         # Full brand logo gold
```

---

## Email Campaign System

### How It Works
1. User fills **Quick Email Generator** (company, country, product, FOB, MOQ, certs)
2. Click **Generate Email** → Groq Llama 3.1 writes personalised email
3. Click **Send Email** → sends via Resend from `hello@brindari.com`
4. For bulk campaigns: **New Campaign** → select product + country → **Launch**
5. Replies land in inbox → click **Classify Replies with AI** → leads auto-promoted

### Email Template Structure (`src/lib/email-html.ts`)
```
HEADER:  [logo icon]  Brindari Global  |  Date (right)
                      Pure. Organic. Global.
──────────────────────────────────────────────────
BODY:    Hi [Name],
         [AI-generated market scope — 2-3 paragraphs]
         [India origin paragraph — fixed, neutral]
         Key details:
         • FOB pricing (from form)
         • MOQ (from form)
         • Certifications (from form — actual names shown)
         • Sample shipment policy
──────────────────────────────────────────────────
SIGNATURE: [logo icon]  Brindari Global
                        Pure. Organic. Global.
                        📧 sales@brindari.com
                        🌐 www.brindari.com
                        📱 +91 7020400283 / 9404772826
──────────────────────────────────────────────────
FOOTER:  Brindari Global · India · Organic Moringa & Superfoods
```

### 5 Outreach Stages
| Step | Purpose | Key content |
|---|---|---|
| 📬 1 | Initial outreach | Market scope + company intro + product details |
| 📩 2 | Follow-up (no reply) | Reference prev email + doc offer |
| 🎁 3 | Sample offer | Certs + sample shipment lead |
| ❓ 4 | Direct ask | One yes/no question |
| 👋 5 | Break-up | 4-line respectful close |

### AI Prompt Rules (enforced)
- Never say "high-quality", "leading", "premium", "we believe"
- Never mention Indian state names or port names
- No sign-off in AI text (template handles signature)
- Product details come from form data, NOT AI-generated

---

## Supabase Tables
```sql
leads          — company, contact, email, country, product_interest, status, score
buyers         — company, contact, country, portal_token
orders         — order_number, buyer_id, product, quantity_kg, fob_price_usd, status
invoices       — invoice_number, order_id, buyer_id, total_usd, status
shipments      — tracking_number, order_id, carrier, status
documents      — filename, doc_type, order_id, status, buyer_access
email_campaigns — name, product, target_country, status, emails_sent
email_logs     — campaign_id, lead_id, email_to, subject, sequence_step, status
suppliers      — company, product, price_per_kg_inr, moq_kg, certifications
supplier_quotes — supplier_id, price_per_kg_inr, quantity_kg, valid_until
revenue        — order_id, amount_usd, type, date
fob_calculations — product, quantity_kg, fob_usd, margin_percent
```

**RLS Policy:** All tables have anon read/write enabled for development (migration `20260515000002_anon_dev_policies.sql`).

---

## Common Issues & Fixes
| Problem | Fix |
|---|---|
| `.next` cache error ("Cannot find module './948.js'") | `rm -rf .next` then restart dev server |
| CSS broken / unstyled pages | Same as above — stale webpack chunks |
| Tailwind v4 component breaking | Never use `@base-ui/react` — use Radix UI |
| `useSearchParams` prerender error | Replace with `window.location.search` in `useEffect` |
| RLS blocking all data | Run anon_dev_policies migration |

---

## What Still Needs Doing
- [ ] Add Tip tooltips to Invoices page (Subtotal, Tax)
- [ ] Update Campaign modal to use MultiSelect for products AND countries
- [ ] Deploy app to production (Vercel recommended)
- [ ] Upload `public/logo-icon.svg` to brindari.com for self-hosted logo fallback
- [ ] Add FSSAI/Organic cert details to email once certifications are confirmed
- [ ] Set up automated weekly report (cron job via `/api/reports/weekly`)

---

## How to Start Dev Server
```bash
cd /Users/mahesh/Brindari_CEO_Dashboard
npm run dev
# Opens at http://localhost:3000
```

If cache is corrupted:
```bash
rm -rf .next && npm run dev
```
