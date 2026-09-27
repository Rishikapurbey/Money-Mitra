# Money Mitra

Money Mitra is a finance app for people who handle their day-to-day money
responsibly, but were never taught about investing — banks, SIPs, mutual
funds, LIC, and where to actually start.

It combines three things most finance apps keep separate:

- **Tracking** — log your transactions and see where your money actually goes
- **Learn** — plain-language explanations of SIPs, mutual funds, FDs, tax
  terms and other money basics, with worked examples in rupees
- **Discuss** — a space to ask questions about money without judgment,
  post under your username or choose to post anonymously

**Live app:** https://money-mitra-three.vercel.app

## Why

A lot of people know how to spend and save responsibly, but the world of
actual investment products is opaque — nobody sits you down and explains
SIPs vs mutual funds vs LIC vs FDs, or when each one makes sense. Money
Mitra is meant to close that specific gap: not a budgeting app, and not
generic financial advice — just a friend that tracks with you and teaches
you along the way.

## Features

- [x] User authentication (signup, login, JWT)
- [x] Transaction tracking with categories, dates, notes, editing and filters
- [x] Monthly view: income, expense and savings rate for any month
- [x] Spending-by-category chart and a 6-month income vs expense trend
- [x] Learn: 28 money terms from basics to advanced, each with a rupee example
- [x] Discuss: questions and replies organised by topic
- [x] Per-post and per-reply choice to post anonymously
- [x] Links from Learn terms into Discuss with the topic preselected
- [x] Responsive layout with a mobile bottom navigation bar

## Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, React Router
**Backend:** Node.js, Express, TypeScript
**Database:** PostgreSQL with Prisma ORM
**Auth:** JWT (7-day tokens), passwords hashed with bcrypt
**Deployment:** Vercel (client), Render (server), Neon (Postgres)

## Project structure

```
money-mitra/
├── client/                 # React + TypeScript frontend
│   └── src/
│       ├── components/     # App and auth layouts
│       ├── lib/            # API client, Learn content, helpers
│       └── pages/          # Dashboard, Discuss, Learn, auth pages
└── server/                 # Node + Express backend
    ├── prisma/             # Schema and migrations
    └── src/modules/        # auth, transactions, posts
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
JWT_SECRET=any-long-random-string
PORT=5000
```

Set up the database, then start the API and the website together in one terminal:

```bash
npm --prefix server exec prisma migrate dev
npm run dev
```

Open http://127.0.0.1:5173. The API runs on http://localhost:5000 and restarts by itself
when server code changes, after `prisma migrate dev`, and after a crash once the file is fixed.
No email setup is needed locally: without `BREVO_API_KEY`, emails (like password reset
links) are printed in the terminal instead of being sent.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | API and website together, with labelled output |
| `npm test` | Server and client tests (server tests use a separate `money_mitra_test` database) |
| `npm --prefix server run typecheck` | Type-check the server |
| `npm --prefix client run lint` | Lint the client |

The client talks to `http://localhost:5000/api` by default. Set
`VITE_API_URL` to point it at a different server.

## API overview

All routes except signup and login need an `Authorization: Bearer <token>` header.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account |
| POST | `/api/auth/login` | Log in and get a token |
| GET | `/api/auth/me` | Current user |
| GET, POST | `/api/transactions` | List (optional `from`/`to` range) or add |
| PUT, DELETE | `/api/transactions/:id` | Edit or delete |
| GET | `/api/transactions/summary` | Income, expense and balance for a range |
| GET | `/api/transactions/trend` | Monthly income and expense |
| GET, POST | `/api/posts` | List (optional `topic`) or ask a question |
| GET, DELETE | `/api/posts/:id` | View with replies, or delete your own |
| POST | `/api/posts/:id/replies` | Reply |
| DELETE | `/api/posts/:id/replies/:replyId` | Delete your own reply |

## Deployment notes

- The server build runs `prisma generate`, then `tsc`, then
  `prisma migrate deploy`, so new migrations reach production on each deploy.
- On Neon, `DATABASE_URL` is the pooled connection (host contains `-pooler`)
  and `DIRECT_URL` is the same string without `-pooler`. Prisma needs the
  direct connection to run migrations.
- `client/vercel.json` rewrites all paths to `index.html` so routes like
  `/dashboard` work when opened directly.
- The Render free tier sleeps when idle, so the first request after a quiet
  period can take up to a minute.

## Roadmap

- Bank SMS/statement parsing for automatic transaction entry
- Personalized Learn suggestions based on tracked spending and questions asked
- Budgets and savings goals per category
- Reporting and moderation tools for Discuss

## Design notes

- Anonymous posts still store the real author internally — the username is
  just hidden in the UI and never sent to other users by the API. This
  allows moderation while still protecting user privacy.
- PostgreSQL was chosen over MongoDB deliberately, since the data
  (users, transactions, posts, replies) is genuinely relational.
- Learn content lives in the client as a typed data file, so terms can be
  added or corrected without a database change.
- Learn is for education only and is not financial advice. Tax terms carry a
  last-reviewed date because rules change with each Budget.

## Status

In active development — this project is being built incrementally with
commits reflecting real day-to-day progress.
