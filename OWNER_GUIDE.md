# Money Mitra: the owner's guide

This is the one file to read if you come back to Money Mitra after months or years and need to
remember everything: what it is, how it is built, what every feature does, where it runs, how to
change it, and what to do when something breaks.

It is written for you, the owner, in plain English. `README.md` is the public description of the
app and `AGENTS.md` is the instruction sheet for AI coding tools. This guide is the full story.

The flowcharts appear as pictures when you open this file on GitHub, or in VS Code with a Mermaid
preview extension. Anywhere else they still read as simple text.

**Snapshot:** written on 18 November 2026, when the app had 35 database tables, 33 database
migrations, 255 server tests and 79 app tests, all passing. Things may have changed since, so trust
the code when it disagrees with this file.

## Contents

1. [Money Mitra in one page](#1-money-mitra-in-one-page)
2. [I want to... (quick answers)](#2-i-want-to-quick-answers)
3. [The big picture](#3-the-big-picture)
4. [Technology used, and why](#4-technology-used-and-why)
5. [Every feature, explained](#5-every-feature-explained)
6. [Every page in the app](#6-every-page-in-the-app)
7. [How things work: flowcharts](#7-how-things-work-flowcharts)
8. [The database](#8-the-database)
9. [Where the code lives](#9-where-the-code-lives)
10. [Every API route](#10-every-api-route)
11. [Privacy and security](#11-privacy-and-security)
12. [Limits and numbers](#12-limits-and-numbers)
13. [Design rules](#13-design-rules)
14. [Running it on your computer](#14-running-it-on-your-computer)
15. [Changing the app](#15-changing-the-app)
16. [Accounts, services and settings](#16-accounts-services-and-settings)
17. [When something breaks](#17-when-something-breaks)
18. [Working with a new AI tool](#18-working-with-a-new-ai-tool)
19. [History, decisions and what is left](#19-history-decisions-and-what-is-left)
20. [Small glossary](#20-small-glossary)

---

## 1. Money Mitra in one page

**What it is:** a personal finance companion for everyday people in India. "Mitra" means friend.

**Who it is for:** people who handle daily money sensibly but were never taught investing. They
have heard of SIPs, mutual funds, FDs and LIC, and nobody ever explained them.

**The idea:** most apps either track money or teach about it. Money Mitra puts four things together:

| Part | What it gives people |
| --- | --- |
| **Track** | Income, spending, accounts, budgets, goals, bills and net worth |
| **Share** | Split trip and flat costs with friends, and settle up over UPI |
| **Learn** | 28 money terms in plain English with rupee examples, plus 5 calculators |
| **Discuss** | Ask money questions without judgment, by name or anonymously, and connect with people |

**Where it lives:**

| What | Address |
| --- | --- |
| Website | https://money-mitra-three.vercel.app |
| API (the server) | https://money-mitra-qg6b.onrender.com |
| Code | https://github.com/Rishikapurbey/Money-Mitra (public) |
| Backups | The private `money-mitra-backups` repo on GitHub |

**The promise that matters most:** nobody can ever see another person's finances. Not other users,
not group members, not even you on the admin page.

**Brand:** calm and trustworthy, deep navy and teal, English only, no emojis. The logo is "Two
friends": two figures side by side whose shoulders form an M.

---

## 2. I want to... (quick answers)

| I want to... | Go to |
| --- | --- |
| Run the app on my computer | [Section 14](#14-running-it-on-your-computer) |
| Set it up on a new computer | [New computer](#on-a-new-computer) |
| Change something and publish it | [Section 15](#15-changing-the-app) |
| Add a database column or table | [Changing the database](#changing-the-database) |
| Find a password, key or dashboard | [Section 16](#16-accounts-services-and-settings) |
| Fix the site when it is down | [Section 17](#17-when-something-breaks) |
| Get data back from a backup | [Backups](#the-backup-needs-to-be-used) |
| Understand how a feature behaves | [Section 5](#5-every-feature-explained) |
| See the rules of how a thing flows | [Section 7](#7-how-things-work-flowcharts) |
| Continue with an AI tool | [Section 18](#18-working-with-a-new-ai-tool) |
| Remember why something was decided | [Section 19](#19-history-decisions-and-what-is-left) |

---

## 3. The big picture

Money Mitra has three main parts, each hosted by a different company. There are two smaller helpers
for email and backups.

```mermaid
flowchart TD
    U["Person on a phone or computer"] --> W["Website<br/>React app hosted on Vercel"]
    W -->|"Asks for data over the internet (JSON)"| A["API server<br/>Express app hosted on Render"]
    A -->|"Reads and saves through Prisma"| D[("PostgreSQL database<br/>hosted on Neon")]
    A -->|"Sends emails"| B["Brevo email service"]
    B --> E["Person's inbox"]
    G["GitHub: Money-Mitra repo<br/>main branch"] -->|"Deploys automatically"| W
    G -->|"Deploys automatically"| A
    G -->|"Runs tests"| C["GitHub Actions CI"]
    K["GitHub: private backups repo<br/>runs every night at 03:00 India time"] -->|"Copies and encrypts the data"| D
```

Think of it like a restaurant:

- **The website (client)** is the dining room: what people see and touch. It holds no lasting data.
- **The API (server)** is the kitchen: it checks who is asking, applies every rule and does the work.
- **The database** is the store room: everything that must be remembered lives here.
- **Brevo** is the postman, for confirmation links, password resets and a few optional alerts.
- **GitHub** holds the recipe book (code). A change to its `main` branch updates the live app.

**Why the website never decides anything important:** anyone can tamper with what runs in their
browser. So privacy, ownership and money rules are always enforced in the API.

### What happens on one request

```mermaid
flowchart TD
    A["The page calls the API<br/>and attaches the login token"] --> B["Security headers and<br/>allowed-website check"]
    B --> C{"Too many requests<br/>from this network?"}
    C -->|"Yes"| C1["429: please wait"]
    C -->|"No"| D{"Is the login token valid<br/>and still current?"}
    D -->|"No"| D1["401: the app returns to Login"]
    D -->|"Yes"| E["Route checks the input"]
    E -->|"Bad input"| E1["400: a message the person can read"]
    E -->|"Good input"| F["Service applies the rules<br/>and uses the database"]
    F -->|"Expected problem"| F1["Readable error such as 403 or 404"]
    F -->|"Unexpected crash"| F2["500: Something went wrong<br/>Details go only to the server log"]
    F -->|"Success"| G["JSON answer"]
    G --> H["The page updates and tells<br/>other cards to refresh"]
```

---

## 4. Technology used, and why

### Website (`client/`)

| Technology | What it does here |
| --- | --- |
| **React 19** | Builds the screens from reusable pieces |
| **TypeScript** | JavaScript with types, catching many mistakes before the app runs |
| **Vite 8** | Runs the local dev website and creates the production files |
| **Tailwind CSS 4** | Styling through small classes, with theme colours in `client/src/index.css` |
| **React Router 7** | Decides which page each web address shows |
| **Recharts 3** | Spending, trend and net worth charts |
| **axios** | Talks to the API and attaches the login token |
| **lucide-react** | The icon set (used instead of emojis) |
| **qrcode** | UPI QR codes on computers |
| **PWA files** | `manifest.webmanifest` and `sw.js` let people install it like a phone app |

### Server (`server/`)

| Technology | What it does here |
| --- | --- |
| **Node.js** | Runs the server (use version 22, the same as CI) |
| **Express 5** | Receives requests and sends answers |
| **TypeScript** | Same benefit as on the website |
| **Prisma 5** | Safe database access and migrations |
| **PostgreSQL** | The database. Chosen because users, money and groups are closely related |
| **jsonwebtoken** | Creates and checks 7-day login tokens |
| **bcryptjs** | Stores passwords as one-way hashes, never as readable text |
| **helmet, cors** | Security headers, and only allowing our website to call the API from a browser |
| **express-rate-limit** | Slows down abuse such as password guessing and spam |
| **dotenv** | Loads local settings from `server/.env` |

`zod` is listed in `server/package.json` but the code does not use it. Input is checked by small
hand-written functions, mainly in `server/src/lib/validation.ts` and each route file.

### Tools for building and checking

| Tool | Purpose |
| --- | --- |
| **Vitest** | Runs tests on both sides |
| **Supertest** | Sends real requests to the API in tests, against a real test database |
| **ESLint** | Finds code problems in the website |
| **nodemon + tsx** | Restarts the local server when code changes |
| **concurrently** | Runs the API and website together with `npm run dev` |
| **GitHub Actions** | Runs checks on every push and runs the nightly backup |

### Hosting and services

| Service | Job | Good to remember |
| --- | --- | --- |
| **Vercel** | Website hosting | Deploys from `main`, project root is `client` |
| **Render** | API hosting | Free tier sleeps, so the first request can take up to a minute |
| **Neon** | PostgreSQL database | Has a pooled address and a direct address |
| **Brevo** | Sending email | Free plan, 300 emails a day |
| **GitHub** | Code, CI, backups | The main repo is public, the backups repo is private |

---

## 5. Every feature, explained

### Getting started and accounts

- **Sign up** with email, username and password. New accounts get starter categories: Food, Rent,
  Transport, Shopping, Bills, Health, Entertainment (spending), Salary and Freelance (income).
- **Usernames** are 3 to 20 letters, numbers or underscores. Names such as `admin`, `support` and
  `moneymitra` are reserved.
- **Passwords** are 8 to 72 characters with at least one letter and one number.
- **Email confirmation:** a link valid for 24 hours. The app works without it, but asking or
  replying in Discuss and receiving optional emails need a confirmed address.
- **Forgot password:** an emailed link valid for 30 minutes and usable once. Using it logs out every
  device.
- **Change email:** the new address must confirm through its own link.
- **Log out everywhere** ends the login on all devices.
- **Welcome checklist on Home:** add a transaction, set a budget, create a goal, read a Learn term.

### Home

The landing page after login. It shows a greeting, the month at a glance, Quick add, and cards that
appear when relevant: getting started, monthly recap or year review, bills due, shared balances,
accounts, net worth, "What we noticed this month", a Learn tip, goals and community activity.

### Tracker (the main feature)

- **Entries:** income or spending with amount, category, date, optional note (up to 200 characters)
  and the account it was paid from or received in.
- **Search and filters** by type, category, account, amount and date range.
- **Monthly view:** income, spending, savings rate, spending by category and a six-month trend.
- **Categories:** your own list. Rename and merge also update older entries, budgets and rules.
- **Budgets:** a monthly limit per category. Alerts come at 80% and 100%, once per category per
  month, with optional email. Only entries in the current month trigger them.
- **Goals:** a target, optional date, money added or withdrawn, full history and a suggested amount
  to save each month.
- **Recurring entries:** two modes, monthly or yearly.
  - **Automatic** (salary, SIP): added by itself when due.
  - **Remind me** (a bill): you get a bell notice two days before and on the day, then mark it paid
    or skip it. A bill can have a varying amount, entered when you pay.
  - The 31st falls on the last day in shorter months. Rules can be paused, resumed or stopped.
- **CSV import:** the file is read on the device. The app finds the table, guesses the columns,
  flags possible duplicates and lets you review before saving. An import can be undone as a whole.
  Limits are 5 MB and 2,000 rows. Excel files are deliberately not supported.
- **Insights ("What we noticed this month"):** plain observations about budgets, spending more than
  earned, savings rate, category changes, where the month is heading and big single expenses. They
  are careful during a running month, so early-month numbers do not give false good news.
- **Undo:** deleting an entry, transfer, budget or goal shows a short Undo option, so a slip is easy
  to reverse.

### Accounts and transfers

- Bank accounts and cash are accounts, and so are credit cards. They work like accounts in a UPI app.
- One account can be the **default**, which new entries start with. Your first account becomes it.
- **A balance is calculated, never stored as a running total.** See the
  [balance flowchart](#how-an-account-balance-is-worked-out).
- **Transfers** move money between your own accounts, such as an ATM withdrawal or paying a card
  bill. They never count as income or spending.
- **Warnings:** a bank or cash balance below zero shows a warning with one-tap Move money. A credit
  card warns at 80% of its limit and when over it.

### Net worth

- What you own minus what you owe, with up to 24 months of history.
- **Own:** bank account, FD or RD, mutual funds and stocks, PF/PPF/NPS, gold, property, cash, other.
- **Owe:** home, vehicle, personal and education loans, credit card, money borrowed, other.
- Accounts follow the Tracker on their own. Items valued by hand can get a monthly bell reminder
  when their values are more than 30 days old.
- Removing an item records zero from that day and hides it, so past net worth stays correct.

### Monthly recap and yearly review

- **Monthly recap:** for a finished month. Needs at least 3 entries for the full view. Shows totals,
  comparison with the month before, top categories, budgets, goals, biggest expense, no-spend days,
  recurring total, accounts, what went well, what to watch and a Learn suggestion.
- It appears on Home for the first 7 days of the next month, with one bell notice.
- **Yearly review:** the same idea for a whole year, or the year so far. Its Home card appears in the
  first two weeks of January.
- There are no summary emails. You decided these should stay inside the app.

### Shared expenses

- **Groups** for trips, flats and outings, with up to 50 people.
- **Members** can be Money Mitra users (who must accept an invite) or just a name for someone not on
  the app. A single-use join link lets that friend take over their named spot later.
- **Inviting:** suggestions appear after 3 typed characters, up to 5 people, and you still press Send.
- **Expenses:** description, amount, payer, category, date, and an equal or exact split.
- **Exact money:** stored in whole paise. ₹100 among three becomes 33.34 + 33.33 + 33.33.
- **Tracker link:** each user's share is added to their own Tracker from their default account.
- **Balances and settling:** the app suggests a short list of payments that clears everyone. Paybacks
  are recorded as transfers between people and are never counted as spending.
- **UPI:** opens the UPI app on a phone or shows a QR code on a computer, then records the payback
  after you confirm.
- **Trust model:** any member can edit or delete an expense. Every change is written to the group's
  activity history and affected people are notified.
- **Leaving:** only when your balance is zero. Archived groups keep history but take no new expenses.

### Learn

28 terms, each with a plain explanation and a rupee example, linked to Discuss.

| Level | Terms |
| --- | --- |
| **Basics** | Budget, Emergency fund, Inflation, Simple interest, Compound interest, Fixed deposit, EMI, Credit score (CIBIL), Liquidity |
| **Intermediate** | Mutual fund, SIP, NAV, Expense ratio, Index fund, Diversification, PPF, EPF, NPS, ELSS |
| **Advanced** | Asset allocation, CAGR, XIRR, Rupee cost averaging, Capital gains, Old vs new tax regime, Section 80C, Credit utilization, Term insurance vs ULIP |

Terms live in `client/src/lib/learn.ts`, so changing them needs no database work. Tax rules change
with each Budget, so review those terms every year. Learn is education, not financial advice.

### Calculators

SIP, EMI, FD, Inflation and Emergency fund. They work without an account, and the formulas are in
`client/src/lib/calculators.ts`.

### Discuss

- **Questions** have a title (5 to 150 characters), optional details (up to 5,000) and a topic:
  Budgeting, Saving, Investing, Loans & Credit, Tax or Other.
- **Anonymous or named**, chosen per question and per reply, with a default in Settings.
- **Replies** can get helpful votes (not on your own) and the asker can accept one answer.
- **Find things** by topic, unanswered, Following or search. "My activity" lists your own posts.
- **Reports:** spam, abusive, misleading money advice or other. At 3 reports the item is hidden from
  everyone and its author is told once. `ADMIN_EMAIL` gets an email for reports.

### People: profiles, follow and search

- **Profile:** photo, cover, display name, @username, bio (up to 160 characters), join date and
  Discuss activity under their name. Anonymous posts are never shown or counted.
- **Photos** are cropped on the device to 256 by 256 and covers to 1500 by 500. This also removes
  hidden details such as location. A cover can be a photo or one of 6 built-in designs.
- **Follow** works like Instagram: public profiles at once, private profiles by request. Making a
  profile public accepts everyone waiting.
- **Private profiles** still appear in search with their identity, but their Discuss activity and
  follower lists are only for the owner and accepted followers.
- **Removing a follower** is possible, and that person is not told.
- **People search** is in the top bar: starts at 2 characters, shows up to 20, people you know first.

### Messages

- One-to-one and text only, up to 2,000 characters. There are no group chats or photos.
- People you follow or share a group with reach your chats directly. Anyone else sends **one message
  as a request** until you accept or reply.
- **Seen** receipts, unsend at any time (both people see "This message was deleted"), and "delete
  conversation" just for yourself.
- **Updates by polling:** an open chat checks every 4 seconds, the inbox every 10 and the top-bar
  count every 20. Polling is used because the free server sleeps, which suits live connections badly.
- Messages are private but **not end-to-end encrypted**. The app must keep saying this honestly.

### Block and report

- **Blocking cuts contact both ways:** no messages, follows, profile views, group invites or search
  results. Follows between the two end.
- **It is silent.** The blocked person sees "Profile not found" or "You can't message this account".
- **Reporting a message** keeps a copy of that message for the admin, even if it is later unsent.
  "Block them too" is offered in the same form.

### Notifications

A bell in the header refreshes every minute. It covers replies, helpful votes, accepted answers,
hidden posts, follows, message requests, budgets, bills, recaps, net worth reminders and shared
group activity. Repeats are grouped into one line. The only regular personal emails are the
optional reply and budget emails.

### Settings

| Group | Sections |
| --- | --- |
| **Account** | Profile; Login & security; Payments (UPI ID) |
| **Preferences** | Appearance; Notifications; Categories |
| **Privacy & data** | Privacy (including blocked people); Your data (import and download); Delete account |
| **Support** | Help & FAQ; Send feedback; About (version and privacy) |

- **Download my data** gives your own records as a file.
- **Delete account** needs your password. See the [flowchart](#deleting-an-account).
- **Feedback** can be an idea, problem, question or other, and arrives by email.

### Admin page (`/admin`)

Only for the account whose confirmed email equals `ADMIN_EMAIL`. Everyone else gets "Page not found".

It shows total and confirmed users, new users, active users, signups per week, how many people use
each feature, Discuss counts, reported questions and replies, reported messages and a people list.

It never shows email addresses, amounts, balances or money totals, and never any chat that was not
reported.

### The app itself

- Light and dark themes, following the device unless you choose.
- Phone layout with a bottom tab bar: Home, Tracker, Discuss, Learn, Calculators.
- Installable on phones. Chrome and Edge can use the app's own Install button, and iPhone users use
  Share > Add to Home Screen. It does not store the app or data for offline use, only a friendly offline
  page. Users get a new version after fully closing and reopening it.

---

## 6. Every page in the app

```mermaid
flowchart LR
    V["Visitor"] --> L["Landing /"]
    L --> S["Sign up / Log in"]
    V --> P["Learn and Calculators<br/>open to everyone"]
    S --> H["Home"]
    H --> T["Tracker"]
    H --> SG["Shared"]
    H --> D["Discuss"]
    H --> P
    T --> T1["Import, Recap,<br/>Year review, Net worth"]
    SG --> SG1["Group page"]
    D --> D1["Question page"]
    D1 --> PR["Profile"]
    H --> TOP["Top bar: Search,<br/>Messages, Bell, Account"]
    TOP --> PR
    TOP --> M["Messages and Chat"]
    TOP --> ST["Settings"]
    TOP --> AD["Admin, only for you"]
```

| Address | Page | Who can open it |
| --- | --- | --- |
| `/` | Landing page | Visitors (signed-in people go to Home) |
| `/signup`, `/login` | Sign up, log in | Visitors |
| `/forgot-password`, `/reset-password` | Password help | Anyone |
| `/verify-email` | Email confirmation | Anyone with the link |
| `/learn`, `/learn/:slug` | Learn list and one term | Anyone |
| `/calculators`, `/calculators/:slug` | Calculators | Anyone |
| `/home` | Home | Signed in (`/dashboard` redirects here) |
| `/tracker` | Tracker | Signed in |
| `/tracker/import` | CSV import | Signed in |
| `/tracker/recap/:month` | Monthly recap | Signed in |
| `/tracker/year/:year` | Yearly review | Signed in |
| `/tracker/net-worth` | Net worth and accounts | Signed in |
| `/shared`, `/shared/:id` | Groups, one group | Signed in, members only for a group |
| `/join/:token` | Join link | Signed in (returns here after login) |
| `/discuss`, `/discuss/:id` | Discuss, one question | Signed in |
| `/u/:username` | Profile | Signed in |
| `/u/:username/followers`, `/following` | Follow lists | Signed in |
| `/follow-requests` | Follow requests | Signed in |
| `/search` | People search | Signed in |
| `/messages`, `/messages/:id` | Inbox, one chat | Signed in |
| `/settings`, `/settings/:section` | Settings | Signed in |
| `/admin` | Admin page | Only the admin account |

---

## 7. How things work: flowcharts

### Signing up and staying logged in

```mermaid
flowchart TD
    A["Sign up: email, username, password"] --> B{"Valid and not<br/>already used?"}
    B -->|"No"| B1["Show the problem"]
    B -->|"Yes"| C["Save the account with a hashed password<br/>and add starter categories"]
    C --> D["Email a confirmation link, valid 24 hours"]
    D --> E["Log in"]
    E --> F["Server issues a 7-day token"]
    F --> G["Browser keeps the token"]
    G --> H["Every API call sends it"]
    H --> I{"Valid, and from the current<br/>token version?"}
    I -->|"Yes"| J["Request continues"]
    I -->|"No"| K["Back to Login"]
    L["Password changed or reset,<br/>or Log out everywhere"] --> M["Token version goes up"]
    M --> I
```

### Adding an entry in the Tracker

```mermaid
flowchart TD
    A["Person saves income or spending"] --> B["API checks it and confirms the<br/>account belongs to this person"]
    B --> C["Save the entry"]
    C --> D{"Spending in this month,<br/>with a budget?"}
    D -->|"Reached 80% or 100%,<br/>first time this month"| E["Bell alert, and email if turned on"]
    D -->|"No alert needed"| F
    E --> F{"Account below zero or<br/>card near its limit?"}
    F -->|"Yes"| G["Show a warning"]
    F -->|"No"| H["Finish"]
    G --> H
    H --> I["Home, accounts and net worth refresh"]
```

### How an account balance is worked out

```mermaid
flowchart TD
    A["Start with the last value typed for the account"] --> B["Look at every entry and transfer<br/>on this account, up to the chosen date"]
    B --> C{"Dated after the typed value,<br/>or added by hand after it?"}
    C -->|"No: the typed value already includes it"| D["Ignore it"]
    C -->|"Yes"| E["Count it on its own date"]
    E --> F{"What kind of account?"}
    F -->|"Bank or cash"| G["Money in adds, money out subtracts"]
    F -->|"Credit card"| H["Spending raises what you owe,<br/>refunds and payments lower it"]
    G --> I["Balance"]
    H --> I
    D --> I
```

CSV imports and automatic recurring entries are saved as if added on their own date, because the
bank already had them when you typed your balance.

**Net worth** = everything you own (with accounts worked out as above) minus everything you owe.

### Recurring entries and bills

There is no timer running on the server, which suits a free server that sleeps. The work happens
when someone opens the app.

```mermaid
flowchart TD
    A["Person opens the app"] --> B["App asks the server to catch up"]
    B --> C["Find rules that are due and not paused"]
    C --> D{"Which mode?"}
    D -->|"Automatic"| E["Add every missed entry once<br/>and move the next due date forward"]
    E --> F["Check budgets"]
    D -->|"Remind me"| G{"Due within 2 days or overdue,<br/>and not yet reminded?"}
    G -->|"Yes"| H["Bell reminder"]
    G -->|"No"| I["Nothing yet"]
    H --> J["Person marks it paid or skips it"]
    J -->|"Paid"| K["Add the entry to the Tracker"]
```

### Importing a CSV

```mermaid
flowchart TD
    A["Choose a CSV file"] --> B["Read it on the device"]
    B --> C["Find the table and guess the columns"]
    C --> D["Person checks the columns"]
    D --> E["Review rows, with possible duplicates flagged"]
    E --> F["Send the chosen rows, up to 2,000"]
    F --> G["Save them together as one import"]
    G --> H["Tracker shows them"]
    H --> I{"Changed your mind?"}
    I -->|"Undo"| J["The whole import is removed"]
```

### A shared expense

```mermaid
flowchart TD
    A["A member adds an expense"] --> B{"Group active, payer and<br/>people valid, shares add up?"}
    B -->|"No"| B1["Show the problem"]
    B -->|"Yes"| C["Save the amount and shares in paise"]
    C --> D["For each member with an account:<br/>add or update their Tracker entry"]
    C --> E["Write a line in group history"]
    C --> F["Notify the people affected"]
    C --> G["Recalculate balances"]
    G --> H["Balance = paid + paybacks made<br/>- own shares - paybacks received"]
    H --> I["Largest debtor pays largest creditor,<br/>repeated until clear"]
    I --> J["Suggested payments"]
```

### Settling up with UPI

```mermaid
flowchart TD
    A["You owe someone in a group"] --> B{"They are active in the group<br/>and have a UPI ID?"}
    B -->|"No"| C["Pay another way, then record it"]
    B -->|"Yes"| D{"Phone or computer?"}
    D -->|"Phone"| E["Open the UPI app with details filled in"]
    D -->|"Computer"| F["Show a QR code"]
    E --> G["You pay in your UPI app"]
    F --> G
    G --> H["You confirm in Money Mitra"]
    C --> I["Payback recorded"]
    H --> I
    I --> J["Balances update. It is not spending."]
```

The app cannot see whether the UPI payment really succeeded. That is why you confirm it yourself.

### Sending a message

```mermaid
flowchart TD
    A["Open a chat from a profile"] --> B{"Blocked either way?"}
    B -->|"You blocked them"| B1["Unblock to message"]
    B -->|"They blocked you"| B2["You can't message this account"]
    B -->|"No block"| C{"Do they follow you, or do<br/>you share a group?"}
    C -->|"Yes"| D["Goes to their inbox"]
    C -->|"No"| E["Goes to their Requests"]
    E --> F["You can send only one message"]
    F --> G{"They accept or reply?"}
    G -->|"Yes"| D
    G -->|"No"| H["It stays a request"]
```

### Reports in Discuss

```mermaid
flowchart TD
    A["Someone reports a question or reply"] --> B["Save one report per person"]
    B --> C["Email ADMIN_EMAIL"]
    B --> D{"Three reports now?"}
    D -->|"No"| E["Stays visible"]
    D -->|"Yes"| F["Hidden from everyone"]
    F --> G["Author is told once"]
    F --> H["Shown on the admin page"]
```

### Deleting an account

```mermaid
flowchart TD
    A["Person confirms with their password"] --> B["Questions, replies and messages<br/>move to Deleted user"]
    A --> C["Tracker, budgets, goals, rules,<br/>categories and private data are deleted"]
    A --> D["Group spots keep the person's name,<br/>so other members' balances still make sense"]
    A --> E["Groups with no other real member are deleted"]
    B --> F["Account removed"]
    C --> F
    D --> F
    E --> F
    F --> G["Encrypted backups age out within 30 days"]
```

### Publishing a change

```mermaid
flowchart TD
    A["Change code on your computer"] --> B["Run tests, type check, lint and build"]
    B --> C["Commit and push to main"]
    C --> D["GitHub Actions runs the checks"]
    C --> E["Vercel builds and publishes the website"]
    C --> F["Render builds the API"]
    F --> G["prisma generate, TypeScript, prisma migrate deploy"]
    G -->|"Works"| H["New API goes live"]
    G -->|"Fails"| I["Old API keeps running.<br/>See Section 17"]
```

CI is a separate check. Do not assume a red CI run stopped a deploy, so test before you push.

### Nightly backup and restore

```mermaid
flowchart TD
    A["03:00 India time"] --> B["GitHub Action in the private repo"]
    B --> C["pg_dump copies the Neon database"]
    C --> D{"Main tables present?"}
    D -->|"No"| E["Run fails and GitHub emails you"]
    D -->|"Yes"| F["Encrypt with BACKUP_PASSPHRASE"]
    F --> G["Save as YYYY-MM-DD.dump.gpg"]
    G --> H["Keep only the last 30 days"]
    H --> I["To check or recover: download one file"]
    I --> J["Run ops/backups/restore.sh"]
    J --> K["New local database with counts to check"]
```

---

## 8. The database

There are 35 tables, defined in `server/prisma/schema.prisma`. That file has comments explaining
the columns, so it is the best place to look for detail.

### Money

```mermaid
erDiagram
    User ||--o{ Transaction : records
    User ||--o{ Category : owns
    User ||--o{ Budget : sets
    User ||--o{ Goal : saves_for
    Goal ||--o{ GoalContribution : has
    User ||--o{ RecurringTransaction : schedules
    RecurringTransaction ||--o{ Transaction : creates
    RecurringTransaction ||--o{ BillPayment : tracks
    User ||--o{ Import : uploads
    Import ||--o{ Transaction : contains
    User ||--o{ NetWorthItem : owns
    NetWorthItem ||--o{ NetWorthValue : has_history
    NetWorthItem ||--o{ Transaction : account_for
    NetWorthItem ||--o{ Transfer : moves
```

### Shared groups

```mermaid
erDiagram
    SharedGroup ||--o{ GroupMember : has
    User |o--o{ GroupMember : may_be
    SharedGroup ||--o{ SharedExpense : has
    GroupMember ||--o{ SharedExpense : paid
    SharedExpense ||--o{ ExpenseShare : split_into
    GroupMember ||--o{ ExpenseShare : owes
    ExpenseShare |o--o| Transaction : appears_as
    SharedGroup ||--o{ Settlement : records
    SharedGroup ||--o{ GroupActivity : logs
```

### Community and messages

```mermaid
erDiagram
    User ||--o{ Post : asks
    Post ||--o{ Reply : has
    User ||--o{ Reply : writes
    Reply ||--o{ ReplyVote : receives
    Post ||--o{ Report : receives
    Reply ||--o{ Report : receives
    User ||--o{ Follow : follows
    User ||--o{ Notification : receives
    User ||--o{ Block : makes
    Conversation ||--|{ ConversationMember : has
    User ||--o{ ConversationMember : joins
    Conversation ||--o{ Message : contains
    Message ||--o{ MessageReport : reported_in
```

### Every table in one line

| Area | Table | Holds |
| --- | --- | --- |
| Account | `User` | Login, profile, privacy choices, UPI ID, notification choices |
| Account | `Avatar`, `CoverPhoto` | Profile images, kept separately so they load only when needed |
| Account | `PasswordReset`, `EmailVerification` | Hashes of emailed links, never the links themselves |
| Tracker | `Transaction` | Every income and spending entry |
| Tracker | `Category` | Each person's category list |
| Tracker | `Budget`, `BudgetAlert` | Limits, and which alerts were already sent |
| Tracker | `Goal`, `GoalContribution` | Goals and their money history |
| Tracker | `RecurringTransaction` | Automatic entries and bill rules |
| Tracker | `BillPayment`, `BillReminder` | What was paid or skipped, and reminders sent |
| Tracker | `Import` | One imported CSV, so it can be undone |
| Accounts | `NetWorthItem`, `NetWorthValue` | Things owned or owed, and typed values over time |
| Accounts | `Transfer` | Money moved between your own accounts |
| Shared | `SharedGroup`, `GroupMember` | Groups and people, including name-only people |
| Shared | `SharedExpense`, `ExpenseShare` | Expenses and each person's part, in paise |
| Shared | `Settlement`, `GroupActivity` | Paybacks and the history lines |
| Discuss | `Post`, `Reply`, `ReplyVote`, `Report` | Questions, answers, votes and reports |
| People | `Follow`, `Notification`, `Block` | Connections, the bell and blocks |
| Messages | `Conversation`, `ConversationMember`, `Message` | Chats and each person's view of them |
| Messages | `MessageReport` | A copy of a reported message |

**Worth remembering:** Tracker amounts are stored in rupees (decimal numbers), while shared group
amounts are whole paise. Categories are stored by name on entries, which is why rename and merge
must update older records.

---

## 9. Where the code lives

```
Money-Mitra/
├── OWNER_GUIDE.md            This file
├── README.md                 Public description of the app
├── AGENTS.md                 Rules and context for AI coding tools
├── package.json              Root commands: npm run dev, npm test
├── .github/workflows/ci.yml  Automatic checks on every push
├── ops/backups/              Backup job source and restore script
├── client/                   The website
│   ├── public/               Icons, install manifest, offline page, service worker
│   └── src/
│       ├── App.tsx           The list of pages and who can open them
│       ├── index.css         Theme colours, light and dark
│       ├── pages/            One file per screen
│       ├── components/       Reusable pieces and Home cards
│       └── lib/              API client, helpers, Learn, FAQs, calculators, CSV reader
└── server/                   The API
    ├── prisma/schema.prisma  Database design
    ├── prisma/migrations/    Every database change, in order
    ├── test/                 API tests
    └── src/
        ├── index.ts          Starts the server
        ├── app.ts            Security setup and the list of API areas
        ├── middleware/       Login check and rate limits
        ├── lib/              Email, validation, tokens, public identity, errors
        └── modules/          One folder per feature
```

Inside `server/src/modules/<area>/`, `*.routes.ts` receives requests and checks input, while
`*.service.ts` holds rules and database work. Pure maths has its own files.

### Where to change common things

| To change... | Look in |
| --- | --- |
| Learn terms | `client/src/lib/learn.ts` |
| Calculators | `client/src/lib/calculators.ts` |
| FAQ answers | `client/src/lib/faqs.ts` (landing page and Settings > Help) |
| Colours | `client/src/index.css` |
| Header and phone tab bar | `client/src/components/AppLayout.tsx` |
| Page addresses | `client/src/App.tsx` |
| Number and rupee formatting | `client/src/lib/ui.ts` |
| Home | `client/src/pages/Home.tsx` and its cards in `components/` |
| Tracker | `client/src/pages/Tracker.tsx` |
| Balance and net worth maths | `server/src/modules/networth/networth.ts` |
| Split and settle maths | `server/src/modules/shared/split.ts` |
| Insight wording | `server/src/modules/transactions/insights.ts` |
| Recap and year review | `server/src/modules/recaps/` |
| Rate limits | `server/src/middleware/rateLimit.ts` |
| Username, password and UPI rules | `server/src/lib/validation.ts` |
| Email sending | `server/src/lib/email.ts` |
| Allowed website addresses | `server/src/app.ts` |

---

## 10. Every API route

All routes start with `/api` and need a login token, except signup, login, password reset, email
confirmation and profile images.

| Area | Base | Routes |
| --- | --- | --- |
| Auth | `/auth` | `POST /signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`; `GET /me` |
| Account | `/account` | `PUT /password`, `/email`, `/username`, `/profile`, `/photo`, `/cover`, `/cover/preset`, `/privacy`, `/email-preferences`, `/upi`; `POST /email/resend`, `/logout-everywhere`; `DELETE /email/pending`, `/cover`, `/photo`, `/`; `GET /export` |
| Transactions | `/transactions` | `GET /`, `/search`, `/categories`, `/summary`, `/trend`, `/insights`; `POST /`; `PUT /:id`; `DELETE /:id` |
| Categories | `/categories` | `GET /`; `POST /`, `/:id/merge`; `PATCH /:id`; `DELETE /:id` |
| Budgets | `/budgets` | `GET /`; `PUT /`; `DELETE /:id` |
| Goals | `/goals` | `GET /`, `/:id/contributions`; `POST /`, `/:id/contributions`; `PUT /:id`; `DELETE /:id` |
| Recurring | `/recurring` | `GET /`; `POST /`, `/run`, `/:id/pause`, `/:id/resume`, `/:id/pay`, `/:id/skip`; `PUT /:id`; `DELETE /:id` |
| Imports | `/imports` | `GET /`; `POST /`; `DELETE /:id` |
| Transfers | `/transfers` | `GET /`; `POST /`; `PUT /:id`; `DELETE /:id` |
| Net worth | `/networth` | `GET /`, `/summary`, `/accounts`, `/items/:id/values`; `POST /items`, `/items/:id/values`; `PUT /items/:id`, `/items/:id/default`; `DELETE /items/:id` |
| Recaps | `/recaps` | `GET /latest`, `/:month`, `/year/:year`; `POST /:month/dismiss`, `/year/:year/dismiss` |
| Shared groups | `/shared` | `GET /groups`, `/summary`, `/groups/:id`, `/groups/:id/people`, `/join/:token`; `POST /groups`, `/join/:token`, `/invites/:id/accept`; `PUT /groups/:id`, `/groups/:id/archive`; `DELETE /invites/:id` |
| Group members | `/shared/groups/:id` | `POST /members`, `/members/:memberId/link`, `/leave`; `DELETE /members/:memberId` |
| Group money | `/shared/groups/:id` | `POST /expenses`, `/settlements`; `PUT /expenses/:expenseId`; `DELETE /expenses/:expenseId`, `/settlements/:settlementId` |
| Discuss | `/posts` | `GET /`, `/activity`, `/:id`; `POST /`, `/:id/replies`, `/:id/replies/:replyId/helpful`, `/:id/report`, `/:id/replies/:replyId/report`; `PUT /:id/accepted`; `DELETE /:id`, `/:id/replies/:replyId` |
| Profiles | `/users` | `GET /:username`, `/:username/followers`, `/:username/following`, `/:username/avatar`, `/:username/cover` |
| Follows | `/follows` | `GET /requests`; `POST /:username`, `/requests/:username/accept`; `DELETE /:username`, `/requests/:username`, `/followers/:username` |
| Search | `/search` | `GET /people` |
| Messages | `/chats` | `GET /`, `/unread`, `/:id`; `POST /`, `/:id/messages`, `/:id/messages/:messageId/report`, `/:id/accept`; `DELETE /:id`, `/:id/messages/:messageId` |
| Blocks | `/blocks` | `GET /`; `POST /:username`; `DELETE /:username` |
| Notifications | `/notifications` | `GET /`, `/unread-count`; `POST /read-all`, `/posts/:postId/read`, `/:id/read` |
| Feedback | `/feedback` | `POST /` |
| Admin | `/admin` | `GET /` |

---

## 11. Privacy and security

### Promises the app must never break

1. **Nobody sees another person's finances.** Profiles show identity and Discuss activity only.
2. **Groups show only that group's expenses,** never anyone's Tracker, budgets, goals or net worth.
3. **The admin page never shows money,** not even a total across everyone.
4. **Anonymous posts stay anonymous.** The real author is stored for moderation but never sent to
   other users.
5. **A UPI ID** is shown only to a group member who owes its owner, while both are in the group.
6. **Messages never contain Tracker data.** The admin sees only reported messages.
7. **Blocking stays silent.**
8. **Be honest:** messages are private but not end-to-end encrypted.
9. **Learn and calculators are education,** not financial advice.

### How accounts are protected

| Protection | How |
| --- | --- |
| Passwords | Hashed with bcrypt, never stored as text |
| Logins | Signed 7-day tokens, cancelled by a password change or "log out everywhere" |
| Emailed links | Random, time-limited, single-use, stored only as hashes |
| Abuse | Rate limits on sensitive actions |
| Errors | Unexpected details stay in server logs |
| Browser access | Only our website address and local development are allowed |
| Other people's identity | Always passes through `server/src/lib/identity.ts`, without emails or ids |
| Secrets | Live in hosting dashboards and your password manager, never in the public repo |
| Backups | Encrypted, private, kept for 30 days |

---

## 12. Limits and numbers

### Rate limits

Counted per network address. They reset if the server restarts.

| Action | Limit |
| --- | --- |
| Failed logins | 10 per 15 minutes |
| New accounts | 5 per hour |
| Failed password checks in account settings | 10 per 15 minutes |
| Password reset emails | 5 per 15 minutes |
| Failed reset or email-confirmation attempts | 10 per 15 minutes |
| Resending confirmation | 3 per 15 minutes |
| Changing email | 5 per 15 minutes |
| Discuss posts and replies | 30 per 10 minutes |
| Reports, in Discuss and messages | 20 per hour |
| Feedback | 5 per hour |
| Profile photo and cover uploads | 20 per hour |
| Follow and block actions | 60 per 10 minutes |
| Messages sent | 100 per 10 minutes |
| Starting new chats | 40 per hour |
| CSV imports | 20 per hour |
| Creating groups and adding people to them | 60 per 10 minutes |
| People search, including group invite suggestions | 150 per 10 minutes |

### Other numbers

| Thing | Value |
| --- | --- |
| Login lasts | 7 days |
| Reset link / confirm link | 30 minutes / 24 hours |
| Reports before hiding | 3 |
| Budget alerts | 80% and 100% |
| Bill reminders | 2 days before, and on the day |
| Missed recurring entries added at once | Up to 36 per rule |
| Group size | 50 people |
| Message length | 2,000 characters |
| Profile photo / cover stored | Up to 70 KB / 200 KB |
| Normal request / import / cover request size | 100 KB / 1 MB / 300 KB |
| Backups kept | 30 days |
| Brevo emails | 300 a day on the free plan |

---

## 13. Design rules

- **Top header navigation,** never a sidebar. Desktop uses the full width, often with a right rail.
  Phones are single-column with a bottom tab bar.
- **Calm money:** plain amounts. Spending uses normal text and "−". Income is green with "+".
- **Indian number format:** ₹1,24,44,128, always through `formatINR`.
- **Quiet actions:** block, delete, report, archive and leave live in ⋯ menus. Risky ones confirm
  inside the menu. Never use browser pop-ups.
- **No emojis.** Use lucide icons and polished copy.
- **Helpful empty screens** that say what to do next.
- **Short, warm English.** SIP, EMI, CIBIL, PPF and UPI are fine. "Log out" lives only in Settings.
- **Colours come from theme tokens,** so light and dark mode both work.
- **Phones first:** check 360px and 320px, using big lakh and crore amounts. Anything wider than the
  screen makes Android zoom out and hides the bottom bar.
- **Logo colours:** navy `#0f1b2d`, teal `#0f6f67`, and `#5cc0ad` on dark.

---

## 14. Running it on your computer

### Every day

1. Start the local database. It does not start by itself after a restart:

   ```bash
   /usr/lib/postgresql/18/bin/pg_ctl -D ~/.local/share/money-mitra-pg/data -l ~/.local/share/money-mitra-pg/log -o "-p 5433 -k $HOME/.local/share/money-mitra-pg -c listen_addresses=127.0.0.1" -w start
   ```

   If it says a server is already running, that is fine.

2. From the project folder, start the app:

   ```bash
   npm run dev
   ```

3. Open http://127.0.0.1:5173. The API runs on http://localhost:5000.

4. Press `Ctrl + C` in the terminal to stop.

Emails are not really sent locally. Links such as email confirmation appear in the terminal.

### Local data

- Your local database is separate from production, on port 5433, in `~/.local/share/money-mitra-pg`.
- `server/.env` holds local settings and is deliberately not on GitHub.
- Demo accounts (`demo_owner`, `demo_asha`, `demo_ashish`, `demo_ashwin`, `demo_ashok`) and a "Demo
  flat" group exist only there. Their passwords were not saved, so it is easiest to create a new
  local account. Do not delete them without deciding to.

### On a new computer

1. Install Git, Node.js 22 and PostgreSQL.
2. Set up an SSH key and add it to GitHub, then clone:

   ```bash
   git clone git@github.com:Rishikapurbey/Money-Mitra.git
   cd Money-Mitra
   ```

   Your current computer uses a special address, `git@github-personal:...`, defined in `~/.ssh/config`
   so it picks the right GitHub key. A new computer does not need it unless it also has two accounts.

3. Install the code libraries:

   ```bash
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

4. Create an empty PostgreSQL database called `money_mitra`.
5. Create `server/.env`, changing the connection details to match your PostgreSQL:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/money_mitra
   DIRECT_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/money_mitra
   JWT_SECRET=PASTE_A_LONG_RANDOM_VALUE
   PORT=5000
   ```

   Create the random value with `openssl rand -hex 32`.

6. Build the tables and run the app:

   ```bash
   cd server
   npx prisma migrate deploy
   cd ..
   npm run dev
   ```

Never put the production database address in this local file.

---

## 15. Changing the app

### The normal routine

```bash
git pull
# make your change, and try it with npm run dev

npm --prefix server test
npm --prefix server run typecheck
npm --prefix client run lint
npm --prefix client test
npm --prefix client run build

git add -A
git status              # read this list and make sure no secret is included
git commit -m "Add a clear one-sentence description of the change"
git push
```

Pushing to `main` publishes the change. Vercel and Render do the rest in a few minutes.

**Check a deployment:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://money-mitra-qg6b.onrender.com/api/chats
```

`401` means the API is up and that route exists. Settings > About in the app shows the website's
commit number.

### House rules

- Commit messages are one plain sentence, such as "Add goal history to the monthly recap".
- Group related work into medium-sized commits, with no AI attribution lines.
- Check screens at 360px, 320px and desktop, in light and dark mode.
- Update `README.md` for visible changes, `client/src/lib/faqs.ts` when behaviour changes, and this
  guide and `AGENTS.md` when how things work changes.
- Never commit passwords, connection addresses, personal emails or production data.
- Add a rate limit to anything that sends email, creates content or searches people.

### Changing the database

Run these from the `server` folder:

1. Edit `prisma/schema.prisma`.
2. Create the migration without applying it:

   ```bash
   npx prisma migrate dev --create-only --name describe_the_change
   ```

3. Read the SQL it created. Look carefully for anything that deletes or rewrites data.
4. **Rename the new folder so its date sorts after every existing migration.** Some older folders
   have future-looking dates, the latest being `20261116220000_...`.
5. Apply and check:

   ```bash
   npx prisma migrate deploy
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
   ```

   The second command should say there is no difference.

6. When pushed, Render applies the migration to production automatically.

Prefer changes that only add things. A new required column needs existing rows filled in by the same
migration. **Never run `prisma migrate reset` or `prisma migrate dev` against production.**

### Tests

Server tests use a real database whose name must contain "test", normally `money_mitra_test`, and
each run wipes it. If two tools run tests together, give each its own database with
`TEST_DATABASE_URL`, or they will fail randomly.

---

## 16. Accounts, services and settings

Keep logins for all of these in your password manager.

| Service | Dashboard | What you do there |
| --- | --- | --- |
| GitHub | https://github.com | Code, CI results, the private backups repo |
| Vercel | https://vercel.com/dashboard | Website deployments and `VITE_API_URL` |
| Render | https://dashboard.render.com | The `Money-Mitra` service, API logs and settings |
| Neon | https://console.neon.tech | The production database and its connection addresses |
| Brevo | https://app.brevo.com | Email usage, API key and sender |

Menu names can change over the years, so look for the closest match.

**On this computer,** the `gh` command is logged in to a different GitHub account from the repo owner.
Create repos and secrets for this project in the browser.

### Hosting settings and secrets

| Name | Where | Purpose | If it is wrong |
| --- | --- | --- | --- |
| `DATABASE_URL` | Render, backups repo uses its own version | Render: pooled Neon address, with `-pooler` | API cannot reach data |
| `DIRECT_URL` | Render | Same address without `-pooler`, for migrations | Deploys fail |
| `JWT_SECRET` | Render | Signs logins, 32 or more random characters | Changing it logs everyone out |
| `APP_URL` | Render | Website address used in email links | Email links go to the wrong place |
| `BREVO_API_KEY` | Render | Allows sending email | Emails only print to the log |
| `EMAIL_FROM` | Render | Sender address, verified in Brevo | Emails do not send |
| `ADMIN_EMAIL` | Render | Admin account and report alerts | Admin page shows "Page not found" |
| `FEEDBACK_EMAIL` | Render, optional | Where feedback goes (else `EMAIL_FROM`) | Feedback goes to the fallback |
| `ALLOWED_ORIGINS` | Render, optional | Extra website addresses, comma-separated | A new domain cannot call the API |
| `VITE_API_URL` | Vercel | API address ending in `/api` | Website cannot reach the API |
| Expose system environment variables | Vercel setting | Shows the commit in Settings > About | About shows less detail |
| `DATABASE_URL` | Backups repo secret | Neon address **without** `-pooler` | Backup fails |
| `BACKUP_PASSPHRASE` | Backups repo secret and password manager | Encrypts backups | **Without it, backups cannot be opened** |

**If a database password ever leaks:** change it in Neon, then update `DATABASE_URL` and `DIRECT_URL`
on Render and the `DATABASE_URL` secret in the backups repo.

### A quick health check, every month or two

- [ ] The website opens and you can log in.
- [ ] The latest run in the backups repo's Actions tab is green.
- [ ] Neon and Brevo show no usage warnings.
- [ ] Reports on `/admin` have been looked at.

### Once a year

- [ ] Run a backup restore drill with `ops/backups/restore.sh`.
- [ ] Review tax-related Learn terms after the Budget.
- [ ] Confirm your password manager still holds every login and `BACKUP_PASSPHRASE`.
- [ ] Check whether Node.js, PostgreSQL, Prisma or the hosts have announced end-of-support dates.

---

## 17. When something breaks

Start by asking: **is it the website, the API, the database or email?**

```mermaid
flowchart TD
    A["Something is wrong"] --> B{"Does the website open?"}
    B -->|"No"| C["Check Vercel deployments"]
    B -->|"Yes"| D{"Does the API status check answer?"}
    D -->|"Nothing after a minute"| E["Check Render events and logs"]
    D -->|"Answers 401"| F{"Do pages fail with errors?"}
    F -->|"Yes"| G["Read Render logs, then check Neon"]
    F -->|"No, only emails fail"| H["Check Brevo and Render logs"]
    F -->|"No, just one screen"| I["Look for a bug in that feature"]
```

### The app is very slow the first time

This is usually normal. Render's free server sleeps and can take up to a minute to wake. If login,
sign-up or a password screen takes more than 4 seconds, the app tells the person it is waking up.

### The website is down or a bad version went live

In Vercel, open Deployments, choose the last good one, and use its rollback or promote option. Then
fix the code and push again.

### The API is down

1. In Render, open the `Money-Mitra` service and read Events and Logs.
2. If a new deploy caused it, roll back to the previous deploy there. A rollback does **not** undo
   database migrations.
3. Check the [hosting settings](#hosting-settings-and-secrets) if the error mentions a missing value.

### A deploy fails with Prisma error P3009

This means a migration failed in production, and Prisma refuses further migrations until you decide
what happened. Go slowly. Nothing here should be rushed.

1. Confirm last night's backup succeeded.
2. Read the failed migration's name and error in Render's build log.
3. Find out whether it changed anything before failing. Get help if you are not certain.
4. Fix the migration in the code.
5. If the database was left as it was before the failed migration, run this from `server`, using the
   production addresses from Render for this one command:

   ```bash
   DATABASE_URL='PRODUCTION_DIRECT_ADDRESS' DIRECT_URL='PRODUCTION_DIRECT_ADDRESS' npx prisma migrate resolve --rolled-back MIGRATION_FOLDER_NAME
   ```

6. Push the fix, or redeploy on Render.

Use `--applied` instead only if you completed that migration's changes by hand. Run production
commands yourself, and do not leave those addresses in files.

### Emails are not arriving

1. Check spam, then Brevo's usage page. The free limit is 300 a day.
2. Look in Render logs for `email not sent` or a Brevo error.
3. Confirm `BREVO_API_KEY`, `EMAIL_FROM` and `APP_URL` on Render.

### The admin page says "Page not found"

Log in with the account whose email equals `ADMIN_EMAIL`, and make sure that email is confirmed.

### Someone cannot see the new version

They need to fully close and reopen the installed app.

### The app will not run locally

| Message | Fix |
| --- | --- |
| Prisma `P1001`, cannot reach `127.0.0.1:5433` | Start the local database ([Section 14](#every-day)) |
| Missing module | Run the three install commands |
| Port 5000 or 5173 is in use | Close the other running copy |
| Tests fail randomly | Another test run is using the same test database |
| Database is behind | Run `npx prisma migrate deploy` inside the `server` folder |

### The backup failed

1. GitHub emails the repo owner. Open the failed run in the backups repo.
2. If the database password changed, update the `DATABASE_URL` secret.
3. If it mentions a PostgreSQL version mismatch, raise `PG_MAJOR` in the job. The source copy is
   `ops/backups/backup.yml`, and the running copy is in the private repo.
4. Use "Run workflow" in Actions to try again.

### The backup needs to be used

**To check a backup or look at old data (safe):** download a `.dump.gpg` file from the `backups`
branch of the private repo, then run:

```bash
ops/backups/restore.sh ~/Downloads/YYYY-MM-DD.dump.gpg
```

It asks for `BACKUP_PASSPHRASE` and creates a new local database. This drill has passed before.

**To recover production (last resort):** this has not been practised on production, so take your
time. Do not restore over the damaged database.

1. Put the app out of use if data is still being damaged.
2. Create a **new empty database** in Neon and copy its direct address.
3. Decrypt and restore:

   ```bash
   gpg --decrypt --output db.dump YYYY-MM-DD.dump.gpg
   pg_restore --no-owner --no-acl --exit-on-error --dbname='NEW_DIRECT_ADDRESS' db.dump
   rm db.dump
   ```

4. Compare user and entry counts, and open the data read-only if you can.
5. On Render, change `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) to the new database.
6. Update the backups repo's `DATABASE_URL` secret and run a fresh backup.

Anything saved after that backup is lost, so keep the old database until you are sure.

---

## 18. Working with a new AI tool

Open the project folder in the tool and start with something like:

> Read AGENTS.md, README.md and OWNER_GUIDE.md first. Then summarise the rules you must follow.
> Discuss your plan with me before writing code, and ask before every commit. My task is: ...

If the tool works in a browser, also say:

> For browser testing, do not use an extension signed in on my other devices. Use Chrome DevTools.

With Claude Code, the Chrome DevTools connection can be added with:

```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

**What you can always ask of an AI tool:**

- A plan in plain English before it changes anything.
- A choice of options with its recommendation.
- Exact click-by-click steps for any dashboard setting.
- The test, type check, lint and build results, plus phone-width checks, before a commit.
- To ask before anything that deletes data, including local data.

**What to keep doing yourself:** run production database commands, enter secrets, and read `git
status` before committing.

---

## 19. History, decisions and what is left

### How it was built

| When (2026) | What happened |
| --- | --- |
| 16 to 30 Aug | Project setup, signup, login, first transaction tracking and first deployment |
| 27 Sep | Navy and teal design, Discuss, Learn, budgets, goals, landing page, calculators, settings, password reset, security hardening, tests and CI |
| 28 Sep | Logo, installable app, insights, Home and Tracker split, notifications, dark mode, recurring entries |
| 29 to 30 Sep | Full-width layouts, Tracker search, custom categories, Settings sections, profiles and follow |
| 2 to 4 Oct | Email confirmation, budget alerts, CSV import, monthly recap, better Discuss, goal history, yearly review |
| 5 Oct | Faster loading, net worth, bill reminders, shared expenses, profile covers, first-use polish |
| 10 Nov | UPI settle-up, invite suggestions, multiple accounts, transfers, credit cards |
| 16 Nov | Backups, admin page, people search, messages, blocking and reports, calmer menus, small-phone fixes |
| 17 to 18 Nov | Landing page update, `AGENTS.md`, this guide |

For the exact record, run `git log --oneline` in the project.

### Decisions worth remembering

| Decision | Why |
| --- | --- |
| Tracker first | It is the daily reason to open the app |
| Top header, no sidebar | You rejected a sidebar and want full-width pages |
| No emojis | They made the product look AI-generated |
| In-app recaps, no digest emails | You did not want summary emails |
| Accounts work like UPI accounts | The earlier "main account" idea was confusing |
| Balances are calculated | Edits and deletions always stay correct |
| Shared amounts in paise | Splits always add up exactly |
| Any group member can edit | Simple and fair, with every change in history |
| Polling for messages | The free server sleeps |
| Catch-up when the app opens | No always-running server is needed |
| CSV only, no Excel | Enough for now |
| Photos stored in our own database | One less outside service |
| Backups in a private repo | The main repo is public |
| Brevo cleanup not done | You decided click tracking and the key can stay as they are |

### Known gap

When you pay a group bill in full, your account drops only by your share, and paybacks do not move
account balances. So bank balances can drift from reality for people who use groups. Net worth and
group balances each make sense on their own, but this has not been joined up yet.

### Ideas, only if you want them

- Fix the shared-expenses gap above.
- Phone push notifications for messages and replies (needs a VAPID key on Render).
- Sentry error alerts for the website and API.
- One-off splits without a group, percentage splits, recurring shared bills, group CSV export.

### Not wanted

Summary or digest emails, a sidebar, emojis, and Excel import for now.

---

## 20. Small glossary

| Word | Meaning |
| --- | --- |
| **Client / frontend** | The website people see |
| **Server / backend / API** | The program that applies rules and uses the database |
| **Route** | One address on the API, such as `GET /api/goals` |
| **Database table** | One organised list of records, like a spreadsheet tab |
| **Migration** | A saved, ordered change to the database design |
| **Prisma** | The tool the server uses to talk to the database |
| **Token** | A signed pass proving who is logged in |
| **Hash** | A one-way scramble, used so passwords and link codes cannot be read back |
| **Rate limit** | A cap on how often something can be done |
| **Repo** | The project's code folder on GitHub |
| **Commit / push** | Save a set of changes / send them to GitHub |
| **`main`** | The branch that goes live |
| **Deploy** | Publishing a new version |
| **CI** | Automatic checks run by GitHub |
| **Environment variable** | A setting kept outside the code, often a secret |
| **Pooled / direct address** | Two ways to reach Neon: everyday traffic / migrations and backups |
| **PWA** | A website that can be installed like a phone app |
| **Polling** | Asking the server repeatedly for anything new |
| **Paise** | One hundredth of a rupee, used for exact splits |
