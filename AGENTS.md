# Money Mitra: guide for AI assistants

This file is for any AI coding assistant working on Money Mitra (`AGENTS.md` is the common name
many tools look for; if a tool doesn't read it on its own, ask it to read this file first). It
explains how the owner likes to work, the rules the product must never break, how the code fits
together, and what is still open.

`README.md` is the public description of the app: features, tech stack, setup, environment
variables, API overview, deployment and backups. Read it too. This file adds what the README
doesn't say, and doesn't repeat it. `OWNER_GUIDE.md` is the owner's plain-English record of the whole
app, with architecture, flowcharts, every feature and repair steps.

The repo is **public**. Never commit secrets, passwords, connection strings, personal email
addresses or anything from the production database.

---

## 1. What Money Mitra is

A personal finance companion for everyday people in India: people who manage daily money
sensibly but were never taught investing. Live at https://money-mitra-three.vercel.app.

- **Tracker** is the hero feature: income and expenses across bank accounts, cash and credit
  cards, budgets, goals, recurring entries and bill reminders, CSV import, net worth, monthly
  recap and yearly review.
- **Shared expenses**: groups for trips and flats, splits in exact paise, settle up over UPI.
- **Learn** (28 money terms with rupee examples) and **calculators** (SIP, EMI, FD, inflation,
  emergency fund), both usable without an account.
- **Discuss**: questions and replies, anonymous or named, helpful votes, accepted answers.
- **People**: profiles, Instagram-style follow, people search, one-to-one messages, block and
  report.
- **Admin page** at `/admin` for the `ADMIN_EMAIL` account only.

Brand: calm and trustworthy, like a modern Indian fintech (deep navy and teal, think Zerodha or
CRED). English only. The logo is the "Two friends" mark: two figures whose shoulders form an M
(navy `#0f1b2d` and teal `#0f6f67`; `#5cc0ad` on dark).

The owner considers the planned product essentially complete; work now is polish, fixes and
features they ask for.

---

## 2. How the owner wants you to work

These are firm preferences, learned over many sessions.

**Process**
- **Discuss first, then build.** Propose a plan and wait for a clear yes before writing code.
  When there are real choices, ask them as short multiple-choice questions with a recommended
  option; the owner likes answering that way.
- **Ask again before every commit.** Show a plain-English summary of what changed and how it was
  checked, propose a commit message, and wait for approval. Then commit and push to `main`.
- **Medium-sized commits** that group work of one kind (e.g. "Calmer Tracker and Net worth: row
  menus, plain amounts, compact filters"), not one commit per file. Commit messages are a single
  plain sentence in the imperative, no prefixes like `feat:`.
- **No AI attribution** in commits or PRs: no `Co-Authored-By` lines, no "Generated with" footers.
  Commits are in the owner's name only.
- **Ask before anything that deletes data**, including the local dev database (e.g.
  `prisma migrate reset`, dropping tables, truncating). Test databases you create yourself are fine.
- **Give setup steps immediately.** If a feature needs an environment variable or a dashboard
  setting (Render, Vercel, Neon, GitHub), give exact click-by-click steps in the same turn, with a
  way to check it worked. Never leave config "for later".
- **Production database:** the owner runs production database commands themselves. Guide them
  one simple step at a time. Migrations reach production automatically on deploy (see section 6).
- **Explain in plain English.** The owner is not a full-time developer. Say what changed for the
  user, what was checked, and anything they must do, without jargon.
- Keep the README up to date with every user-visible change (it has no roadmap section; don't add one).
  Update `OWNER_GUIDE.md` too when features, architecture, operations or decisions change.

**Checking work**
- Run the relevant tests, type checks, lint and build before proposing a commit.
- Look at UI changes in a real browser at phone width (360px and 320px) and desktop, in light and
  dark mode. The owner mainly uses the installed app on an Android phone.
- For browser testing, use the Chrome DevTools MCP if available, not a browser extension that is
  signed in on the owner's other devices. In Claude Code it is added with
  `claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest`, followed by a restart.

---

## 3. Product rules that must never be broken

- **Nobody can ever see another person's finances.** Profiles show identity (photo, name,
  @username, bio) and Discuss activity only. Shared groups show only that group's expenses, never
  anyone's Tracker, budgets, goals, accounts or net worth. The admin page shows counts and
  identity, never amounts, balances or any money total, not even added up across everyone.
- **Anonymous posts** store the real author internally (for moderation) but the API never sends
  it to other users.
- **A UPI ID** is shown only to a group member who owes its owner, only while both are in the group.
- **Messages** never carry anything from the Tracker. The admin only ever sees messages that were
  reported (a copy taken at report time), never the rest of a chat. Be honest in copy: messages
  are private but not end-to-end encrypted.
- **Blocking is silent.** The blocked person sees "Profile not found" / "You can't message this
  account", never that they were blocked.
- **No emojis anywhere in the UI.** The owner feels they make the product look AI-generated. Use
  lucide icons and plain, polished copy.
- **Education, not advice.** Learn and calculators are educational; keep the disclaimers.

---

## 4. Design language

- **Layout:** top header navigation (the owner rejected a sidebar). Content uses the full width
  on desktop: multi-column grids, often a main column plus a 340-380px right rail. Never a narrow
  centred single column on desktop. Phones are single-column with a bottom tab bar
  (Home, Tracker, Discuss, Learn, Calculators); Shared is reached from Tracker/Home on phones.
- **Quiet secondary actions:** rare or destructive actions (block, delete, report, archive,
  leave, remove) go in a ⋯ / ⋮ menu (`client/src/components/ActionMenu.tsx`), with a confirm
  step inside the menu for anything hard to undo. Only primary actions (Follow, Message,
  Add expense, Update value) are visible buttons. Rows that edit something open on tap.
- **Calm money:** amounts are plain text; spending in the normal text colour with "−",
  income in green with "+". No red pills on every row. Use the real minus sign "−" (U+2212).
- **Numbers:** Indian formatting via `formatINR` (`client/src/lib/ui.ts`), e.g. ₹1,24,44,128.
  Big figures must never overflow on a 320px phone (see section 7).
- **Empty states are helpful:** say what to do next with a link or button, not just "Nothing here".
- **Copy:** short, warm, plain English for Indian users (SIP, EMI, CIBIL, PPF, UPI are fine).
  "Log out" lives only in Settings, not in the header menu.
- **Theme tokens** (Tailwind v4, defined in `client/src/index.css`): `bg-canvas`, `bg-surface`,
  `border-line`, `text-ink-900/700/500/400`, `brand-*` (teal), `gain`, `loss`, `warn` and their
  `-soft` variants, `chart-1..6`. `.dark-panel` keeps navy hero panels navy in dark mode. Never
  hard-code colours that won't adapt to dark mode.

---

## 5. Code map and conventions

Monorepo: `client/` (React 19 + TypeScript + Vite + Tailwind v4 + React Router 7 + Recharts)
and `server/` (Express 5 + TypeScript + Prisma 5 + PostgreSQL). Root `npm run dev` runs both.

### Server (`server/src`)
- `app.ts` wires middleware and mounts each module's router at `/api/<area>`.
- `modules/<area>/` holds `<area>.routes.ts` (thin: auth, validation, status codes) and
  `<area>.service.ts` (logic and Prisma). Pure, testable logic sits in plain files
  (e.g. `networth/networth.ts`, `shared/split.ts`, `recaps/recap.ts`).
- Errors meant for users: `throw new HttpError(status, "Message the user can read")`
  (`lib/httpError.ts`). Anything else becomes a generic 500.
- Auth: `authMiddleware` sets `req.userId`; it also refreshes `User.lastActiveAt` at most hourly.
- Rate limits live in `middleware/rateLimit.ts`; add one for anything that sends email, creates
  content or searches people.
- Public identity of a person always goes through `lib/identity.ts` (`identitySelect`,
  `identity()`); never return emails or ids of other users.
- The "Deleted user" placeholder account (`DELETED_USERNAME`) takes over posts, replies and
  messages when someone deletes their account (`account.service.ts` → `deleteAccount`).
- Blocking is enforced through `modules/blocks/block.service.ts` (`blockBetween`,
  `refuseIfBlocked`, `blockedIds`) in profiles, follows, search, chat and the group-invite route.
- Comments explain *why*, in plain English, above the code they describe. Keep that style.

### Database
- Schema: `server/prisma/schema.prisma`. Main models: User, Transaction (with `accountId`,
  `recurringId`, `importId`, `shareId`, `createdAt`), Category, Budget, BudgetAlert, Goal,
  GoalContribution, RecurringTransaction, BillPayment, BillReminder, Import, NetWorthItem,
  NetWorthValue, Transfer, SharedGroup, GroupMember, SharedExpense, ExpenseShare, Settlement,
  GroupActivity, Post, Reply, ReplyVote, Report, Follow, Notification, Conversation,
  ConversationMember, Message, Block, MessageReport, Avatar, CoverPhoto, PasswordReset,
  EmailVerification.
- **Migrations:** create with `npx prisma migrate dev --create-only --name <name>`, review the
  SQL, then **rename the folder so its timestamp sorts after every existing migration** (some
  earlier ones use hand-picked timestamps like `20261116220000_...`). Apply locally with
  `npx prisma migrate deploy` and check `npx prisma migrate diff --from-schema-datasource
  prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma` says "No difference".
  Prefer additive migrations; backfill new non-null columns in the same SQL.

### Client (`client/src`)
- `App.tsx`: routes. Pages load on demand with `lazyPage()` (reloads once after a new deploy).
- `components/AppLayout.tsx`: header (search, messages, theme, bell, account menu), phone tab bar,
  and the `me` context (`useOutletContext<AppContext>()`).
- `lib/api.ts`: axios client with the token; a 401 logs the user out.
- `lib/dataEvents.ts`: `announceDataChange()` / `onDataChange()` make Home cards, accounts and net
  worth refresh after any Tracker change; `announceChatsChange()` refreshes the messages badge;
  `announceNotificationsChange()` the bell. Call them after mutations.
- `lib/toast.ts` (`useToast`), `lib/useTitle.ts`, `lib/useMediaQuery.ts` (`useWideLayout` = 1280px+),
  `lib/ui.ts` (`formatINR`, `inputClass`, `pageWidth`).
- Reusable pieces: `ActionMenu`, `PersonRow`, `Avatar`, `AccountSelect`, `ProfileMenu`,
  `ReportForm`, `QuickAddSheet`, `BackToTop`.
- Help answers live in `lib/faqs.ts` (`faqs` on the landing page, `appFaqs` in Settings > Help).
  Update them when behaviour changes.
- Never use `window.alert/confirm/prompt`; use inline confirms or `ActionMenu` confirms.

### Tests
- Server: Vitest + Supertest against a real Postgres test database (`server/test`). Helpers:
  `createUser()` (returns `auth` header), `resetDatabase()` (add new tables to its TRUNCATE list).
  Mock email with `vi.mock("../src/lib/email", ...)` when a test sends mail.
- The owner's local Postgres is a personal instance on port 5433 (`money_mitra` for development),
  with its files in `~/.local/share/money-mitra-pg`. It stops after a reboot; if Prisma reports P1001,
  start it with the command in `OWNER_GUIDE.md` section 14. Demo accounts (`demo_*`) and the "Demo
  flat" group in that database are kept on purpose; their passwords were not saved.
- The test database name must contain "test". `TEST_DATABASE_URL` overrides the default
  (`money_mitra_test` on the local server). **If two AI sessions work in the repo at once, give
  each its own test database**: each run truncates it, so parallel runs fail randomly.
- Client: Vitest for pure helpers in `lib/*.test.ts`.
- Commands: `npm --prefix server test`, `npx tsc --noEmit` (server), `npm --prefix client run lint`,
  `npm --prefix client test`, `npm --prefix client run build`.

---

## 6. Deployment and operations

- **Website:** Vercel, project root `client`, auto-deploys from `main`.
  Env: `VITE_API_URL`. "Expose system environment variables" must stay on (Settings > About shows
  the commit).
- **GitHub on the owner's computer:** pushes use the `github-personal` SSH alias. The `gh` CLI is
  logged in to a different account, so the owner creates repos and secrets in the browser.
- **API:** Render web service at https://money-mitra-qg6b.onrender.com, auto-deploys from `main`. Build runs
  `prisma generate && tsc && prisma migrate deploy`, so **migrations apply on every deploy**; a
  failed migration blocks deploys (Prisma P3009) until resolved. Free tier sleeps; the first
  request can take up to a minute.
- **Database:** Neon Postgres. `DATABASE_URL` is the pooled URL (host contains `-pooler`),
  `DIRECT_URL` the same without `-pooler` (needed for migrations, `pg_dump`).
- **Email:** Brevo free plan (300/day). Without `BREVO_API_KEY`, emails print to the console.
  The owner does not want summary/digest emails; notifications are in-app.
- **Backups:** nightly encrypted `pg_dump` by a GitHub Action in a separate *private* repo
  (`money-mitra-backups`, source kept here in `ops/backups/backup.yml`), last 30 days on its
  `backups` branch. Restore drill: `ops/backups/restore.sh <file.dump.gpg>` into a new local DB.
  The encryption passphrase is in the owner's password manager.
- **Checking a deploy:** an unknown API route returns 404 and an existing protected one 401
  without a token, e.g. `curl -s -o /dev/null -w '%{http_code}' <api>/api/chats` → 401.
- The installed PWA caches nothing but an offline page (`client/public/sw.js`); users get the new
  version after fully closing and reopening the app.

---

## 7. Gotchas already learned

- **Phones and overflow:** anything wider than the screen makes Android zoom the page out, which
  pushes the fixed bottom tab bar behind the gesture bar. Guards in place: `overflow-x: clip` on
  `body`, `.grid` defaults to `grid-template-columns: minmax(0,1fr)` (in `index.css`), big figures
  use `whitespace-nowrap` and step down a size when long, and the header is sized to fit 320px.
  Check new screens at 320px with lakh/crore amounts.
- **Safe areas:** the viewport uses `viewport-fit=cover`; the header, tab bar, toasts, bottom
  sheets and Back-to-top add `env(safe-area-inset-*)`. Keep that for anything fixed to an edge.
- **Menus inside cards:** cards with `overflow-hidden` clip dropdowns; `ActionMenu` renders into
  `document.body` (portal) for that reason. Events from a portal still bubble through React parents.
- **Net worth rule:** an account's balance = its last typed-in value + Tracker entries and
  transfers that are dated after it *or were added by hand after it* (counted on their own date).
  Imports and automatic recurring entries are saved with `createdAt = date`. Only items valued by
  hand (gold, funds, property, loans) trigger the "values are out of date" reminder.
- **Shared expenses:** amounts in whole paise; your share is a Tracker expense (`shareId`), from
  your default account. Settle-ups are never spending.
- **Known gap (not fixed, owner deferred it):** when you pay a group bill in full, your account
  only drops by your share, and paybacks don't move account balances, so bank balances can drift
  from reality for people who use groups.
- **Chat** uses polling (4s open chat, 10s inbox, 20s badge), not websockets, because Render's
  free tier sleeps. Message requests: strangers get one message until accepted.
- **Express 5** passes rejected async route errors to the error handler automatically.
- `npx prettier` is not part of the project; don't reformat files wholesale.

---

## 8. Open ideas (only start when the owner asks)

- Fix the shared-expenses gap above (count the full amount you paid; paybacks move accounts).
- Phone push notifications for messages and replies (web push; needs a VAPID key on Render).
- Sentry error alerts for the website and API (planned, postponed by the owner).
- Shared expenses later: one-off splits without a group, percentage splits, recurring shared
  bills, group CSV export.
- Not wanted: summary/digest emails, a sidebar, emojis, Excel import (CSV only for now).
- Already declined, don't suggest again: Brevo cleanup (click tracking, rotating its API key).
