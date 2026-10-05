# Money Mitra

Money Mitra is a finance app for people who handle their day-to-day money
responsibly, but were never taught about investing — banks, SIPs, mutual
funds, LIC, and where to actually start.

It brings together what most finance apps keep separate:

- **Track**: log income and expenses, set budgets and goals, and see each month clearly
- **Learn**: plain-language explanations of money terms, with worked examples in rupees
- **Discuss**: ask questions about money without judgment, under your name or anonymously
- **Share**: split trips and flat costs with friends and settle up

**Live app:** https://money-mitra-three.vercel.app

## Why

A lot of people know how to spend and save responsibly, but the world of
actual investment products is opaque — nobody sits you down and explains
SIPs vs mutual funds vs LIC vs FDs, or when each one makes sense. Money
Mitra is meant to close that specific gap: not just a budgeting app, and not
generic financial advice — a friend that tracks with you and teaches you
along the way.

## Features

### Tracker
- Transactions with categories, dates and notes; search and filters by type, category, amount and date range
- Quick add from Home, and your own category list with rename and merge
- Monthly view with income, expenses and savings rate, a spending-by-category chart and a six-month trend
- Budgets per category, with alerts in the app at 80% and 100% (and optional emails)
- Savings goals with contributions, history and a suggested monthly amount
- Recurring transactions: added automatically (salary, SIPs) or as bill reminders you mark paid or skip, monthly or yearly
- Import past months from a bank statement CSV, with undo
- Net worth: what you own minus what you owe, with history. Your main bank or cash account moves with your Tracker income and expenses
- A monthly recap and a yearly review, plus plain observations about your month ("What we noticed this month")

### Shared expenses
- Groups for trips, flats and outings; invite people by username, or add friends who aren't on the app by name
- A join link lets a friend take over the spot they were added under
- Split equally or by exact amounts; each person's share goes into their own Tracker
- Balances, the fewest payments needed to settle up, and recorded paybacks (never counted as spending)
- Any member can edit an expense; every change is kept in the group's activity history

### Learn and calculators
- 30 money terms from basics to advanced, each with a rupee example and links into Discuss
- SIP, EMI, FD, inflation and emergency fund calculators, usable without an account

### Discuss and profiles
- Questions and replies by topic, with search, helpful votes and an accepted answer
- Post under your name or anonymously, per question and per reply
- Reports hide a post after three reports, and the team is emailed
- Profiles with a photo, cover, name and bio; private profiles and Instagram-style follow requests
- A notification bell for replies, follows, budgets, bills, recaps and shared groups; reply emails you can turn off

### Account and app
- Email confirmation, password reset, changing email, username and password, logging out everywhere
- Download all your data, or delete your account
- Light and dark themes, a phone layout with a bottom tab bar, and installable as an app (PWA)

## Privacy

- Nobody can see another person's finances. Profiles show identity and Discuss activity only.
- In a shared group, members see only what's added to that group — never anyone's Tracker, budgets, goals or net worth.
- Anonymous posts store the real author internally for moderation, but the API never sends it to other users.
- Profile photos and covers are cropped and resized on the device before upload, which also removes hidden details such as location.

## Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, React Router
**Backend:** Node.js, Express, TypeScript
**Database:** PostgreSQL with Prisma ORM
**Auth:** JWT (7-day tokens), passwords hashed with bcrypt
**Email:** Brevo
**Tests:** Vitest and Supertest (server against a real test database), Vitest (client)
**Deployment:** Vercel (client), Render (server), Neon (Postgres)

## Project structure

```
money-mitra/
├── client/                 # React + TypeScript frontend
│   ├── public/             # Icons, PWA manifest and service worker
│   └── src/
│       ├── components/     # Layouts, cards, forms and shared pieces
│       ├── lib/            # API client, Learn content, calculators, helpers
│       └── pages/          # Home, Tracker, Shared, Discuss, Learn, Settings, ...
└── server/                 # Node + Express backend
    ├── prisma/             # Schema and migrations
    ├── src/modules/        # account, auth, budgets, categories, feedback, follows, goals,
    │                       # imports, networth, notifications, posts, profiles, recaps,
    │                       # recurring, shared, transactions
    └── test/               # API tests
```

## Running locally

Requirements: Node.js 20+ and a PostgreSQL database.

Install everything once:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

Create `server/.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/money_mitra
DIRECT_URL=postgresql://user:password@localhost:5432/money_mitra
JWT_SECRET=any-long-random-string-of-32-or-more-characters
PORT=5000
```

Set up the database, then start the API and the website together in one terminal:

```bash
npm --prefix server exec prisma migrate dev
npm run dev
```

Open http://127.0.0.1:5173. The API runs on http://localhost:5000 and restarts by itself
when server code changes. No email setup is needed locally: without `BREVO_API_KEY`,
emails (like password reset links) are printed in the terminal instead of being sent.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | API and website together, with labelled output |
| `npm test` | Server and client tests (server tests use a separate `money_mitra_test` database) |
| `npm --prefix server run typecheck` | Type-check the server |
| `npm --prefix client run lint` | Lint the client |

The client talks to `http://localhost:5000/api` by default. Set
`VITE_API_URL` to point it at a different server.

## Environment variables

Server (`server/.env` locally, Render in production):

| Variable | Needed | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection (on Neon, the pooled one) |
| `DIRECT_URL` | Yes | Direct Postgres connection, used by Prisma for migrations |
| `JWT_SECRET` | Yes | Signs login tokens; at least 32 random characters |
| `PORT` | No | Defaults to 5000 |
| `APP_URL` | In production | The website's address, used in email links |
| `BREVO_API_KEY`, `EMAIL_FROM` | In production | Sending emails; without them emails are printed to the console |
| `ADMIN_EMAIL` | No | Receives Discuss report alerts, and replies to account emails |
| `FEEDBACK_EMAIL` | No | Receives feedback from Settings (defaults to `EMAIL_FROM`) |
| `ALLOWED_ORIGINS` | No | Extra website addresses allowed to call the API, comma-separated |

Client (Vercel): `VITE_API_URL`, the API's address ending in `/api`.

## API overview

All routes need an `Authorization: Bearer <token>` header, except signup, login, password
reset, email confirmation, and profile photos and covers (which load in `<img>` tags).

| Area | Base route | Covers |
| --- | --- | --- |
| Auth | `/api/auth` | Signup, login, current user, password reset, email confirmation |
| Account | `/api/account` | Profile, photo, cover, username, email, password, privacy, notification settings, data export, deletion |
| Transactions | `/api/transactions` | Add, edit, delete, search; monthly summary, trend and insights |
| Categories | `/api/categories` | Your category list, rename and merge |
| Budgets, goals | `/api/budgets`, `/api/goals` | Budgets per category; goals and contributions |
| Recurring | `/api/recurring` | Recurring rules, catch-up on app open, paying or skipping bills |
| Imports | `/api/imports` | CSV import and undo |
| Recaps | `/api/recaps` | Monthly recap and yearly review |
| Net worth | `/api/networth` | Items, values, history and the main account |
| Shared | `/api/shared` | Groups, invites, join links, expenses, payments, balances |
| Discuss | `/api/posts` | Questions, replies, votes, accepted answers, reports, search |
| People | `/api/users`, `/api/follows` | Profiles, photos, covers, followers and follow requests |
| Notifications | `/api/notifications` | The bell |
| Feedback | `/api/feedback` | Feedback from Settings |

## Deployment notes

- The server build runs `prisma generate`, then `tsc`, then
  `prisma migrate deploy`, so new migrations reach production on each deploy.
- On Neon, `DATABASE_URL` is the pooled connection (host contains `-pooler`)
  and `DIRECT_URL` is the same string without `-pooler`. Prisma needs the
  direct connection to run migrations.
- `client/vercel.json` rewrites all paths to `index.html` so routes like
  `/tracker` work when opened directly.
- Pages load on demand, so the first download stays small.
- The Render free tier sleeps when idle, so the first request after a quiet
  period can take up to a minute; the app says so instead of looking frozen.

## Design notes

- PostgreSQL was chosen over MongoDB deliberately, since the data
  (users, transactions, posts, groups) is genuinely relational.
- Shared group amounts are stored in whole paise, so splits always add up exactly.
- A main account's balance and net worth are worked out from the last value you typed in plus
  the Tracker since then, rather than stored, so edits and deletions are always reflected.
- Learn content lives in the client as a typed data file, so terms can be
  added or corrected without a database change.
- Learn is for education only and is not financial advice. Tax terms carry a
  last-reviewed date because rules change with each Budget.

## Status

Complete and live. Development of the planned features is finished; the app is ready for
everyday use and is maintained with fixes and small improvements.

Ideas for later: error alerts, a tested backup routine, a private usage page, and more
shared-expense options (splitting without a group, UPI pay links, recurring shared bills).
