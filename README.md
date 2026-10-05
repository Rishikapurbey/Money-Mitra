# Money Mitra

**A personal finance companion for everyday people in India.**

Money Mitra is for people who manage their day-to-day money responsibly but were never
taught how investing works: SIPs, mutual funds, FDs, LIC, and where to start. It brings
together what most finance apps keep separate:

- **Track**: log income and expenses, set budgets and goals, and see each month clearly
- **Learn**: plain-language explanations of money terms, with worked examples in rupees
- **Discuss**: ask questions about money without judgment, under your name or anonymously
- **Share**: split trips and flat costs with friends and settle up

**Live app:** [money-mitra-three.vercel.app](https://money-mitra-three.vercel.app)

## Contents

- [Why Money Mitra](#why-money-mitra)
- [Features](#features)
- [Privacy](#privacy)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Deployment](#deployment)
- [Design notes](#design-notes)

## Why Money Mitra

Many people know how to spend and save sensibly, yet investment products remain opaque.
Nobody explains the difference between a SIP, a mutual fund, LIC and an FD, or when each
one makes sense. Money Mitra closes that gap. It is neither just a budgeting app nor generic
financial advice, but a companion that tracks your money with you and explains things along
the way.

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
- In a shared group, members see only what's added to that group, never anyone's Tracker, budgets, goals or net worth.
- Anonymous posts store the real author internally for moderation, but the API never sends it to other users.
- Profile photos and covers are cropped and resized on the device before upload, which also removes hidden details such as location.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts, React Router |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Authentication | JWT (7-day tokens), passwords hashed with bcrypt |
| Email | Brevo |
| Testing | Vitest and Supertest (server, against a real test database); Vitest (client) |
| Hosting | Vercel (client), Render (server), Neon (PostgreSQL) |

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

**Requirements:** Node.js 20 or later, and a PostgreSQL database.

Install the dependencies:

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

Apply the database migrations, then start the API and the website together:

```bash
npm --prefix server exec prisma migrate dev
npm run dev
```

Open http://127.0.0.1:5173. The API runs on http://localhost:5000 and restarts automatically
when server code changes. No email setup is needed locally: without `BREVO_API_KEY`,
emails such as password reset links are printed to the terminal instead of being sent.

**Commands**

| Command | What it does |
| --- | --- |
| `npm run dev` | API and website together, with labelled output |
| `npm test` | Server and client tests (server tests use a separate `money_mitra_test` database) |
| `npm --prefix server run typecheck` | Type-check the server |
| `npm --prefix client run lint` | Lint the client |

The client calls `http://localhost:5000/api` by default. Set `VITE_API_URL` to use a
different server.

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

## Deployment

- The server build runs `prisma generate`, `tsc` and `prisma migrate deploy`, so new
  migrations reach production on every deploy.
- On Neon, `DATABASE_URL` is the pooled connection (its host contains `-pooler`) and
  `DIRECT_URL` is the same string without `-pooler`. Prisma needs the direct connection to
  run migrations.
- `client/vercel.json` rewrites every path to `index.html`, so routes such as `/tracker`
  work when opened directly.
- Pages are loaded on demand, which keeps the first download small.
- Render's free tier sleeps when idle, so the first request after a quiet period can take up
  to a minute. The app tells the user it is waking up rather than appearing frozen.

## Design notes

- **Relational data, relational database.** Users, transactions, posts and groups are
  closely linked, so PostgreSQL was chosen over a document store.
- **Exact splits.** Shared group amounts are stored in whole paise, so shares always add up
  to the total.
- **Computed balances.** The main account's balance and net worth are calculated from the
  last value entered plus Tracker activity since then, rather than stored, so edits and
  deletions are always reflected.
- **Content as code.** Learn terms live in the client as a typed data file, so they can be
  added or corrected without a database change.
- **Education, not advice.** Learn is for education only and is not financial advice. Tax
  terms carry a last-reviewed date because rules change with each Budget.
