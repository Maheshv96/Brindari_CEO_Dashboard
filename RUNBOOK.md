# Brindari CEO Dashboard — Dev → Deploy Runbook

How the CEO Dashboard moves from a local code change to a live URL, every tool involved, and how to make changes going forward.

- **Repo:** github.com/Maheshv96/Brindari_CEO_Dashboard
- **Stack:** Next.js 14 · Supabase · Vercel
- **Live:** https://brindari-ceo-dashboard.vercel.app

---

## The pipeline

```
1. Develop  → edit code locally, test with the dev server
2. Commit   → save a checkpoint with git
3. Push     → send commits to GitHub
4. Build    → Vercel builds the production bundle
5. Live     → deployed and reachable on the internet
```

---

## Accessing the dashboard

Live at **https://brindari-ceo-dashboard.vercel.app** — open it and you land on the sign-in screen, not the dashboard, since login is enforced in production.

- Sign in with your email and the password you set, at `/login`
- Forgotten it? Use **"Forgot password?"** on that screen — it emails you a reset link directly
- Buyers never see this — they get a separate, read-only view at `/portal` through their own invite link

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS v3 + Radix UI |
| Database | Supabase — Postgres with Row Level Security |
| Auth | Supabase Auth — email/password + magic links |
| AI | Groq (Llama 3.1) — email generation & reply classification |
| Email delivery | Resend |
| PDF generation | pdfmake — invoices |
| Charts | Recharts — revenue & analytics |
| Image processing | sharp — logo SVG → PNG for emails |
| Web scraping | Playwright — supplier discovery |
| Hosting | Vercel |
| Version control | Git + GitHub |

---

## Local development — npm

Every change starts here — run the app on your own machine and check it in a browser before it goes anywhere near production.

```bash
# install dependencies (first time, or after package.json changes)
npm install

# run the dev server — opens at localhost:3000
npm run dev

# production build — catches build-only errors before deploying
# (this caught the /login Suspense bug)
npm run build
```

## Version control — git

Every meaningful change gets its own commit — a labeled checkpoint you can always come back to.

```bash
# stage specific files (never blanket "add everything" — avoids
# accidentally committing secrets)
git add src/app/login/page.tsx

# commit with a message explaining why, not just what
git commit -m "Fix production build error on /login"

# check what's changed and what's staged
git status
git log --oneline
```

## GitHub — gh CLI

GitHub stopped accepting account passwords for git operations, so `gh` handles login through your browser instead — no token to copy-paste.

```bash
# one-time install
brew install gh

# one-time login — opens a browser to authorize
gh auth login

# connect this local repo to a GitHub repo, then send commits there
git remote add origin https://github.com/Maheshv96/Brindari_CEO_Dashboard.git
git push -u origin main

# every push after the first is just
git push
```

## Database — Supabase CLI

Schema and security-policy changes are written as numbered migration files and pushed to the live database — never edited by hand in the Supabase dashboard, so there's always a record of what changed and why.

```bash
# check which local migrations haven't been applied to the live project yet
supabase migration list --linked

# apply new migration files to the live database
supabase db push --linked

# push auth settings (site URL, allowed redirect links) from
# config.toml to the live project
supabase config push --project-ref mhigscquusomebsvcjya
```

## Hosting & deployment — Vercel CLI

Vercel builds the Next.js app and serves it publicly. Once connected to GitHub, every push to `main` triggers a new build automatically — the manual deploy command is only needed for a one-off deploy outside that flow.

```bash
# one-time install and login
brew install vercel-cli
vercel login

# connect this folder to a Vercel project (first time only)
vercel link --project brindari-ceo-dashboard

# add a secret to the live environment (asks for the value privately,
# never typed into the command itself)
vercel env add RESEND_API_KEY production

# list which variables are configured, without ever showing their values
vercel env ls

# manual production deploy (auto-deploy from GitHub push is the normal path)
vercel deploy --prod
```

---

## Monitoring

Three systems, three different jobs: Vercel tells you if the app is running, Supabase tells you what's happening to your data, GitHub tells you what code is where.

### Vercel — is the app up and serving requests?

**In the browser:** vercel.com → project → **Deployments** (build history, click one for full logs) · **Logs** tab (live runtime errors) · **Settings → Environment Variables** (confirm config)

**From the terminal:**
```bash
vercel ls
vercel inspect <deployment-url>
```

### Supabase — is the data and login system healthy?

**In the browser:** supabase.com/dashboard → **Table Editor** (browse/edit rows directly) · **Authentication → Users** (confirm account exists, check "Last sign in") · **Logs** (Postgres/Auth/API, filterable)

**From the terminal:**
```bash
supabase migration list --linked
```

### GitHub — what code is actually deployed?

**In the browser:** github.com/Maheshv96/Brindari_CEO_Dashboard → **Commits** (history, with a check mark next to each once Vercel finishes deploying it)

**From the terminal:**
```bash
git log --oneline -5
```

---

## Health check — is everything actually working?

Run through this any time you want to be sure, especially right after a deploy.

**From the terminal:**
```bash
# login page should load
curl -I https://brindari-ceo-dashboard.vercel.app/login
# expect: HTTP/2 200

# root should redirect — proves the login wall is active
curl -I https://brindari-ceo-dashboard.vercel.app/
# expect: HTTP/2 307

# latest deployment should say Ready
vercel ls

# database schema should be in sync
supabase migration list --linked
# Local and Remote columns should match
```

**In the browser:**
1. Open the live URL — you should land on `/login`, not the dashboard
2. Sign in — you should reach the dashboard, sidebar and all
3. Open DevTools → Console — no red errors
4. Click **Sign out** — you should land back on `/login`
5. Vercel's Deployments tab shows the newest one as a green "Ready"
6. Supabase's Authentication → Users shows a recent "Last sign in" for your account

---

## Making a change — three kinds, three paths

Not every change needs a code deploy. Which path you take depends on what's actually changing.

**1 · A record or number** — fix a lead, correct an order, edit pricing
No code involved. Either edit it right in the dashboard itself (most pages support this directly), or for anything the UI doesn't expose yet, edit the row directly in **Supabase → Table Editor**. Takes effect immediately — nothing to deploy.

**2 · A setting or secret** — a new API key, a changed URL, a config value
Add or update it in **Vercel → Settings → Environment Variables** (or `vercel env add` from the terminal), then trigger a redeploy for it to take effect — either push any small commit, or run `vercel deploy --prod` directly.

**3 · Behavior, layout, or logic** — anything that means editing code
This is the one that goes through Claude Code. The loop:

1. **Tell it what you want changed** — a bug, a new field, different wording, anything.
2. **It makes the change and tests it locally** before anything is saved permanently.
3. **It commits** — a checkpoint with a clear message explaining why.
4. **It pushes to GitHub** — this step always waits for your go-ahead first.
5. **Vercel rebuilds automatically** and the live site updates within a minute or two — no manual redeploy needed.

---

## Quick reference

| Tool | Command | What it does |
|---|---|---|
| npm | `npm run dev` | Start the local dev server |
| npm | `npm run build` | Run a real production build locally |
| git | `git status` | See what's changed and staged |
| git | `git add <file>` | Stage a specific file |
| git | `git commit -m "…"` | Save a labeled checkpoint |
| git | `git push` | Send commits to GitHub |
| gh | `gh auth login` | Log into GitHub via browser |
| Supabase | `supabase db push --linked` | Apply schema/RLS migrations to the live database |
| Supabase | `supabase migration list --linked` | See which migrations are pending |
| Vercel | `vercel env ls` | Confirm which env vars are configured |
| Vercel | `vercel deploy --prod` | Manually deploy to production |

---

*Brindari CEO Dashboard — internal reference, last updated after the initial production deployment.*
