# AutoApply

> Build your profile once. Get alerted when jobs drop. Apply with one reply.

## Setup

**1. Clone and install**
```bash
git clone https://github.com/surajvaddi/placeholder1.git
cd placeholder1
npm install
```

**2. Add your API key**
```bash
cp .env.local.example .env.local
```
Open `.env.local` and add your Anthropic key:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Get one at [console.anthropic.com](https://console.anthropic.com).

**3. Run**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Flow

```
/ (landing)
  → /onboarding  (4 steps: profile → preferences → resume → phone)
  → /dashboard   (Twin status + application history)
```

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Language | TypeScript |
| AI | Claude API (`claude-sonnet-4-6`) |
| PDF parsing | `pdf-parse` |
| Animations | Framer Motion |

---

## What's next

- [ ] Supabase auth + database (users, profiles, jobs, alerts, applications tables)
- [ ] Yutori Scouting API — 1 global scout, webhook on new jobs
- [ ] Matching logic — backend query against all user profiles on webhook
- [ ] Twilio SMS — outbound alerts + inbound YES/NO/STOP handler
- [ ] Resend email — alert delivery + apply CTA
- [ ] Yutori Browsing API — auto-apply agent per confirmed alert
- [ ] Stripe — Free / Pro / Turbo tiers
