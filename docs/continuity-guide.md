# Bramley Golf Club — Continuous Improvement Programme
## System Continuity Guide
### What to do if the developer is unavailable

*Prepared by John de Wit — June 2026*
*For the attention of: Club Chairman and Club Manager*

---

> **Why this document exists**
>
> The CIP system was built and is maintained by John de Wit, a club member. This document tells you everything you need to know to keep the system running, deal with problems, and — if necessary — hand it to someone else. You should not need a technical background to follow these instructions.
>
> Keep this document somewhere safe and accessible. It contains no passwords (for security reasons) but tells you exactly where everything lives and who to contact.

---

## Contents

1. [What the system is and where it runs](#1-what-the-system-is-and-where-it-runs)
2. [The accounts you need access to](#2-the-accounts-you-need-access-to)
3. [Day-to-day operation — what runs automatically](#3-day-to-day-operation--what-runs-automatically)
4. [What the Club Manager can do without a developer](#4-what-the-club-manager-can-do-without-a-developer)
5. [What requires a developer](#5-what-requires-a-developer)
6. [If the system stops working](#6-if-the-system-stops-working)
7. [Emergency data recovery](#7-emergency-data-recovery)
8. [Finding a replacement developer](#8-finding-a-replacement-developer)
9. [Handing the system over](#9-handing-the-system-over)
10. [Summary — the one-page version](#10-summary--the-one-page-version)

---

## 1. What the system is and where it runs

The CIP is a web application. It runs entirely in the cloud — there is no server in the clubhouse, no local computer involved, and nothing that needs to be switched on or maintained physically.

### What it consists of

| Component | What it is | Where it is |
|---|---|---|
| **The application** | The website members and directors use | Vercel (cloud hosting) |
| **The database** | All submissions, scores, members, config | Neon (cloud database) |
| **The code** | The source files that make the app work | GitHub (code repository) |
| **Email sending** | Sends emails to members and directors | Resend (email service) |
| **AI scoring** | The intelligence behind the scoring | Anthropic Claude API |

All of these are third-party cloud services with their own reliability and uptime guarantees. None of them require active management in normal operation.

### The website address

The app runs at: **`https://bramley-bci.vercel.app`** (or a custom domain if one has been configured).

### Automatic operations

The system runs two automatic tasks every week:
- **Monday 07:00** — scores all new member submissions and emails directors
- **Sunday 06:00** — emails a data backup to the Club Manager

These run without anyone doing anything.

---

## 2. The accounts you need access to

Five online accounts keep the system alive. Each account has login credentials that should be stored securely (use the club's password manager, or a sealed envelope kept by the Secretary).

### Account list

**1. GitHub** — `github.com`
- *What for:* Stores all the code. Also where the documentation files live.
- *Account:* John's GitHub account (`johnnydw-bit`). The repository is `BCI`.
- *What you can do here:* Read the code, download files, invite a new developer to collaborate.
- *What happens if lost:* A new developer can fork the code and carry on independently.

**2. Vercel** — `vercel.com`
- *What for:* Hosts the website and runs the automatic weekly tasks.
- *Account:* John's Vercel account.
- *What you can do here:* See if the app is running, check error logs, redeploy if needed.
- *Critical:* The `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `MANAGER_EMAIL`, and `EMAIL_FROM` environment variables are stored here. These are the "secrets" that make everything work. A new developer will need these values.
- *What happens if lost:* The app stops working. The database is separate (Neon) so data is safe, but the app needs to be redeployed with the correct environment variables.

**3. Neon** — `neon.tech`
- *What for:* The database. Contains every submission, score, director record, config value, and audit trail.
- *Account:* John's Neon account.
- *What you can do here:* View the data directly, restore from a backup, export data.
- *Critical:* This is where all the data lives. Even if everything else fails, the data here is safe.
- *What happens if lost:* A new database can be created and data restored from a JSON backup file.

**4. Resend** — `resend.com`
- *What for:* Sends all emails (member notifications, director reports, backups).
- *Account:* John's Resend account.
- *What you can do here:* See email sending history, check if emails are being delivered, manage the sending domain.
- *What happens if lost:* Emails stop sending. The app still works, members just won't receive notifications. A new Resend account can be set up with a new API key.

**5. Anthropic** — `console.anthropic.com`
- *What for:* The AI that scores submissions and generates member emails.
- *Account:* John's Anthropic account.
- *What you can do here:* See API usage, manage billing, get a new API key.
- *What happens if lost:* The scoring process stops working (triage will fail). The app's data and member portal still work. A new API key from a new account restores full function.

### Getting access to these accounts

John should have shared the credentials for all of the above with the Club Secretary or stored them in the club's secure records. If credentials are not available, each service has an account recovery process using the registered email address. That email address is John's — which is why having a good relationship with John, or acting promptly if the situation arises, matters.

> **Action recommended now (while John is available):** Ask John to add the Club Manager as a collaborator on the Vercel project and the GitHub repository. This costs nothing and means you have direct access without needing John's personal login.

---

## 3. Day-to-day operation — what runs automatically

In normal circumstances, the system requires **no human intervention**. The following happens automatically:

| Day / time | What happens |
|---|---|
| **Monday 07:00 UTC** | New submissions are scored by AI; directors receive email reports; high-scoring items trigger immediate alerts; H&S items are flagged |
| **Sunday 06:00 UTC** | A CSV data backup is emailed to the Club Manager's email address |

The only regular human task is:
- **Directors review the triage report** at their convenience after Monday morning
- **Club Manager acts on submissions** — changing statuses, setting target dates, assigning owners
- **Club Manager periodically downloads a full JSON backup** (Admin → Setup → Full backup) and stores it somewhere safe (email it to yourself, save to a USB drive, put it in cloud storage)

---

## 4. What the Club Manager can do without a developer

The Club Manager has full access to the Admin panel and can handle all of the following independently:

| Task | Where |
|---|---|
| Add or remove directors | Admin → Directors |
| Reset a director's PIN | Admin → Directors → Edit → Reset PIN |
| Change scoring weights and thresholds | Admin → Scoring Config |
| Change email tone and sign-off | Admin → Communications |
| View dashboard statistics | Admin → Dashboard |
| Download a full data backup | Admin → Setup → Full backup (JSON) |
| Restore submissions from a CSV backup | Admin → Setup → Restore from CSV |
| Run the triage scoring manually | Admin → Setup → Run triage now |
| Add new database columns after an update | Admin → Setup → Initialise database |
| Add and manage test data | Admin → Setup → Test data |

---

## 5. What requires a developer

The following tasks cannot be done through the app and require someone who can write code:

| Task | Complexity |
|---|---|
| Adding a new feature to the app | Medium–High |
| Changing which categories exist | Low — a code change and redeploy |
| Adding a new director role | Low — a code change and redeploy |
| Changing the scoring prompt given to the AI | Low — a code change and redeploy |
| Fixing a bug or error | Low–Medium depending on the issue |
| Moving to a different hosting provider | Medium |
| Setting up a custom domain name | Low |
| Upgrading to a paid Neon or Vercel tier | Low — account change only |
| Restoring from a full JSON backup if the app is down | Low — run a script (see Section 7) |

For the restore script specifically, any technically competent person with Node.js installed on their laptop can run it — they don't need to understand the code.

---

## 6. If the system stops working

### The app shows a blank page or error

1. Wait 5 minutes and try again — Vercel occasionally has brief hiccups
2. If it persists, log in to Vercel (`vercel.com`) and check the deployment status and error logs
3. If there are error logs mentioning "database" or "column does not exist" — this usually means a code update was deployed without running the database initialisation. If a director can still sign in, they can run: **Admin → Setup → Initialise database**
4. If you cannot log in at all, paste this into the browser console on any page of the app:
   ```
   fetch('/api/admin/init-db', {method:'POST'}).then(r=>r.json()).then(console.log)
   ```
   This only works if a director session cookie is still active in that browser.

### Emails have stopped arriving

1. Check the Resend dashboard for delivery errors
2. Check that the `RESEND_API_KEY` in Vercel's environment variables is still valid
3. Check the email hasn't exceeded Resend's free tier sending limits (100 emails/day on the free tier)

### The scoring (triage) is failing

1. Check the Anthropic dashboard for API errors or billing issues
2. Check that the `ANTHROPIC_API_KEY` in Vercel's environment variables is still valid
3. The AI has usage costs — check that the Anthropic account is funded and not over limit

### Something has gone seriously wrong with the data

See Section 7 — Emergency data recovery.

---

## 7. Emergency data recovery

### What backups exist

| Backup type | How often | Where |
|---|---|---|
| **CSV backup** | Automatically every Sunday | Emailed to Club Manager |
| **Full JSON backup** | On demand — download from Admin → Setup | Wherever you saved it |

> **Important:** The JSON backup is far more complete than the CSV. It includes every table — submissions, scores, clusters, audit trail, config, and directors. Store JSON backups somewhere safe outside the app (email, USB drive, or cloud storage like OneDrive or Google Drive).

### If data is corrupted or accidentally deleted (app is still working)

1. Go to **Admin → Setup → Restore from CSV** and upload the most recent CSV backup
2. This restores submission records — it upserts (updates or inserts) without deleting anything

### If the database is lost or destroyed (full recovery)

This is the "worst case" scenario. You need:
- A full JSON backup file
- A computer with Node.js installed (any modern Windows, Mac, or Linux laptop)
- The `DATABASE_URL` from the Neon account (the connection string for the database)

Steps:
1. Create a new database in Neon if the old one is gone (or use the existing one if it still exists)
2. Find the project folder on John's computer (or clone it from GitHub)
3. Open a terminal (Command Prompt on Windows) in the project folder
4. Run: `node scripts/restore.js path\to\your-backup.json`
5. The script will reconnect all the data and print a summary

A developer can do this in under 30 minutes with a recent backup.

---

## 8. Finding a replacement developer

If a new developer is needed to maintain or extend the system, here is what they need to know:

### Technical summary for a developer handover

- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, hosted on Vercel
- **Database:** PostgreSQL via Neon (serverless), accessed with `@neondatabase/serverless`
- **AI:** Anthropic Claude claude-sonnet-4-6 for scoring, claude-haiku-4-5 for moderation and emails
- **Email:** Resend
- **Auth:** Custom JWT via `jose`, no third-party auth provider
- **Repo:** `github.com/johnnydw-bit/BCI` — private repository
- **Documentation:** Full technical context is in the conversation history and the `docs/` folder

### What to give a new developer

1. Access to the GitHub repository (add them as a collaborator)
2. Access to the Vercel project (add them as a team member)
3. Access to the Neon project (add them as a collaborator)
4. A copy of this document and the Board guide
5. A recent full JSON backup so they understand the data structure
6. The environment variables from Vercel (DATABASE_URL, ANTHROPIC_API_KEY, RESEND_API_KEY, MANAGER_EMAIL, EMAIL_FROM, NEXT_PUBLIC_APP_URL, DEBUG_EMAIL)

### Cost of the system per month

On the current free tiers:
- **Vercel:** Free (Hobby plan — suitable for low traffic)
- **Neon:** Free (0.5 GB storage, plenty for this use case)
- **Anthropic:** Pay-per-use — approximately £2–£10/month depending on submission volume
- **Resend:** Free up to 100 emails/day, 3,000/month — sufficient for current use
- **GitHub:** Free (public or private repository)
- **Total: approximately £2–£10/month**

If usage grows, Vercel Pro (~£15/month) and Neon Scale (~£15/month) offer higher limits and better reliability.

### Where to find a developer

- **Recommended first:** Ask among club members — there may be someone with relevant skills who would be happy to help
- **Local options:** Contact a local web development agency or freelancer
- **Online:** Platforms such as Upwork, Toptal, or Codementor — search for "Next.js developer" or "TypeScript developer"
- **Estimated cost for ongoing maintenance:** £50–£150/hour for a freelancer; the system is well-documented and a competent developer should need minimal time for routine updates

---

## 9. Handing the system over

If a new developer takes over, the formal handover consists of:

**Step 1 — Transfer repository ownership**
In GitHub: Settings → Danger Zone → Transfer ownership. Transfer `BCI` to the new developer's GitHub account, or to a club-owned GitHub organisation.

**Step 2 — Transfer Vercel project**
In Vercel: Add the new developer as a team member, or redeploy the project under their account with the same environment variables.

**Step 3 — Transfer Neon database**
In Neon: Add the new developer as a collaborator, or give them the `DATABASE_URL` connection string so they can connect from a new deployment.

**Step 4 — Transfer Resend account**
Add the new developer to the Resend account, or set up a new Resend account and update the `RESEND_API_KEY` in Vercel.

**Step 5 — Transfer Anthropic account**
The new developer can use their own Anthropic account — just update `ANTHROPIC_API_KEY` in Vercel.

**Step 6 — Test everything**
After transfer: run Initialise Database, seed test data, run a manual triage, and verify emails are sending.

---

## 10. Summary — the one-page version

**The system runs itself.** Triage happens every Monday. Backups are emailed every Sunday. Directors review the report and make decisions. The Club Manager acts through the Admin panel. No IT involvement needed for routine operation.

**If something goes wrong:**
1. Wait a few minutes and try again
2. Log in to Admin and run "Initialise database"
3. Check the Vercel dashboard for error messages
4. Check Anthropic and Resend accounts for billing or quota issues
5. If data is lost — restore from the JSON backup using the restore script

**The important things to have, right now:**
- ✅ Login credentials for Vercel, Neon, GitHub, Resend, and Anthropic — stored securely
- ✅ A recent full JSON backup stored somewhere outside the app
- ✅ This document, kept somewhere accessible
- ✅ John's contact details — even in an emergency, a quick phone call is often the fastest fix

**Finding help:**
The codebase is clean, well-documented, and uses standard modern technologies. Any competent Next.js developer can pick it up. The `docs/` folder in the GitHub repository contains all user and technical documentation.

---

*Document prepared by John de Wit — June 2026*
*Bramley Golf Club Continuous Improvement Programme*

*Review this document annually or after any major system change.*
