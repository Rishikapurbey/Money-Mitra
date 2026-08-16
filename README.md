# Money Mitra

Money Mitra is a finance app for people who handle their day-to-day money
responsibly, but were never taught about investing — banks, SIPs, mutual
funds, LIC, and where to actually start.

It combines three things most finance apps keep separate:

- **Tracking** — log your transactions and see where your money actually goes
- **Learn** — plain-language articles explaining SIPs, mutual funds, FDs, LIC
  and other investment basics, surfaced based on what you're tracking or
  asking about
- **Discuss** — a space to ask questions about money without judgment,
  post under your username or choose to post anonymously

## Why

A lot of people know how to spend and save responsibly, but the world of
actual investment products is opaque — nobody sits you down and explains
SIPs vs mutual funds vs LIC vs FDs, or when each one makes sense. Money
Mitra is meant to close that specific gap: not a budgeting app, and not
generic financial advice — just a friend that tracks with you and teaches
you along the way.

## Tech stack

**Frontend:** React, TypeScript, Vite
**Backend:** Node.js, Express, TypeScript
**Database:** PostgreSQL with Prisma ORM
**Auth:** JWT with refresh tokens
**Caching / rate limiting:** Redis
**Deployment:** Vercel (client), Railway/Render (server), Neon/Railway (Postgres)

## Project structure

money-mitra/
├── client/ # React + TypeScript frontend
├── server/ # Node + Express backend

## Features (MVP)

- [ ] User authentication (signup, login, JWT)
- [ ] Manual transaction tracking with categories
- [ ] Dashboard with spending/savings insights
- [ ] Blog section with investment-basics articles
- [ ] Discussion threads with pseudonymous or anonymous posting
- [ ] Per-post choice to hide username

## Roadmap (post-MVP)

- Bank SMS/statement parsing for automatic transaction entry
- Personalized article recommendations based on tracked data

## Design notes

- Anonymous posts still store the real author internally — the username is
  just hidden in the UI. This allows moderation while still protecting
  user privacy.
- PostgreSQL was chosen over MongoDB deliberately, since the data
  (users, transactions, posts, replies) is genuinely relational.

## Status

🚧 In active development — this project is being built incrementally with
commits reflecting real day-to-day progress.