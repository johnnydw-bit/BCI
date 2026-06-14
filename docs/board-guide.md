# Bramley Golf Club — Continuous Improvement Programme
## Board & Director Guide

*Version 1.2 — June 2026*

---

## Contents

1. [Programme overview](#1-programme-overview)
2. [Roles and access levels](#2-roles-and-access-levels)
3. [Installing the app](#3-installing-the-app)
4. [Signing in](#4-signing-in)
5. [The triage dashboard](#5-the-triage-dashboard)
6. [Understanding scores and bands](#6-understanding-scores-and-bands)
7. [Filters and sorting](#7-filters-and-sorting)
8. [Managing submissions — the sidebar](#8-managing-submissions--the-sidebar)
9. [Target dates and confirmed cost](#9-target-dates-and-confirmed-cost)
10. [Board notes](#10-board-notes)
11. [Score override](#11-score-override)
12. [Audit trail](#12-audit-trail)
13. [Owner assignment](#13-owner-assignment)
14. [Tracking approved improvements](#14-tracking-approved-improvements)
15. [Submitting an improvement as a director](#15-submitting-an-improvement-as-a-director)
16. [Email reports](#16-email-reports)
17. [The member view](#17-the-member-view)
18. [Session security](#18-session-security)
19. [Admin panel](#19-admin-panel)
20. [Budget management](#20-budget-management)
21. [Frequently asked questions](#21-frequently-asked-questions)

---

## 1. Programme overview

The Continuous Improvement Programme (CIP) collects, scores, and prioritises member improvement ideas using an AI-assisted structured assessment process. The workflow is:

1. **Member submits** an idea via the programme website
2. **Automated moderation** checks the submission for appropriateness
3. **Immediate AI assessment** — an initial narrative (pros, considerations, commercial factors) is generated and shown to the member straight away, along with a confirmation email
4. **Overnight scoring** — every night, unscored submissions are fully evaluated: scored across six weighted dimensions, grouped into clusters with similar ideas, and assigned to an owner. Score bonuses are applied for clustered themes
5. **Triage dashboard** presents scored submissions to directors for decision
6. **Directors act** — use the sidebar to set status, assign owners, set target dates, and add notes, then save all changes at once
7. **Members are notified** by AI-generated email when the status of their idea changes

The system is designed to ensure every submission is treated fairly and consistently, reducing the administrative burden on the Board while maintaining full accountability.

---

## 2. Roles and access levels

| Role | Sees in triage | Can change status / assign owner | Admin panel |
|---|---|---|---|
| **Golf Director** | Course, Competitions & Matches | No | No |
| **Estate Director** | Clubhouse, Grounds, On-course Refreshments | No | No |
| **F&B Director** | Restaurant, Bar, On-course Refreshments | No | No |
| **Commercial Director** | Pro Shop | No | No |
| **Operations Manager** | All categories | Yes | No |
| **Chair of the Board** | All categories | Yes (final authority) | No |
| **Club Manager** | All categories | **Yes** | **Yes** |
| **Super Admin** | All categories | **Yes** | **Yes** (full access) |

> **Note:** All directors can recommend decisions on submissions in their categories. Decisions move through a ratification chain: Director → Operations Manager → Club Manager → Chair of the Board. The Chair of the Board has final authority and their decisions cannot be overridden. Only Club Manager and Super Admin can access the Admin panel or delete submissions.

---

## 3. Installing the app

The Board portal can be installed on your device so it opens like a native app — no browser address bar or tabs.

**The Board URL is:** `https://bramley-bci.vercel.app/board`

**Chrome (Desktop — Windows or Mac)**
1. Open Chrome and go to the Board URL
2. Look for the install icon (⊕) in the address bar, far right
3. Click it and select **Install**
4. The app will open in its own window and appear in your taskbar / applications

**Android (Chrome)**
1. Open Chrome and navigate to the Board URL
2. Tap the three-dot menu (⋮) in the top right
3. Tap **Add to Home screen**
4. Confirm the name and tap **Add**
5. The app icon will appear on your home screen

**iPhone / iPad (Safari)**
1. Open Safari and navigate to the Board URL
2. Tap the Share button (the box with an arrow pointing up) at the bottom of the screen
3. Scroll down and tap **Add to Home Screen**
4. Confirm the name and tap **Add**
5. The app icon will appear on your home screen

> **Tip:** Installing the app gives the best experience — it opens full screen with no browser chrome, ideal for use on a tablet during Board meetings.

---

## 4. Signing in

Directors sign in using a **6-digit PIN** assigned by the Club Manager.

**Steps:**
1. Open the app or go to the Board URL
2. Enter your PIN
3. Click **Sign in**

> **Forgotten your PIN?** Contact the Club Manager who can reset your PIN from the Admin panel. A new PIN will be generated and communicated to you.

> **Locked out?** After 5 failed attempts, access is locked for 15 minutes.

> **Sessions:** Director sessions last 8 hours. An inactivity warning appears after 110 minutes and you are signed out automatically at 120 minutes. Move your mouse or press a key to reset the timer.

---

## 5. The triage dashboard

After signing in, you are taken to the **Triage Dashboard** — the main working view for directors.

### Tabs

The dashboard has three tabs:

- **Improvements** — all live submissions in your categories (not moderation-rejected), ordered by H&S flag then score
- **Tracking** — approved and implemented improvements, with project tracking fields
- **Moderated** — submissions silently rejected by the automated moderation gate (Club Manager only)

### The improvements table

Each row shows:
- **Score** — out of 10, colour-coded by band. A ⏳ symbol means the submission has not yet been through overnight scoring
- **Improvement** — AI summary (or original description if not yet scored)
- **Area, implementation complexity, cost estimate, date**
- **Decision** — status dropdown (managers only) or badge
- **Owner** — owner dropdown (managers only) or text
- **Flags** — ⚠ H&S, ⚡ Quick win, 💰 Revenue, £ Board approval, ⚖ External approval, 📅 Seasonal, 🔁 Recurring

Click any row to open the **detail sidebar** on the right.

### The detail sidebar

The sidebar shows the full AI assessment and the Board Decision panel. All changes are held as a draft until you click **Save changes** — nothing is sent to the database or triggers an email until you save.

The Save button appears at the **top of the sidebar** (next to the close button) and at the **bottom of the Board Decision panel**. It shows "No changes" when the draft matches the saved state, and "Save changes" when there are unsaved edits.

### Summary counts

The header shows counts of pending submissions (Awaiting Decision + Under Consideration) and total submissions. H&S flagged items are highlighted in red and always appear at the top of the table.

---

## 6. Understanding scores and bands

### When scoring happens

The AI generates a **narrative assessment** immediately when a member submits (shown to them on screen and emailed). However, **scoring** (the numerical score and score band) happens in the overnight triage run, not at submission time. This is because:

- Scores include **cluster bonuses** — applied when multiple submissions address the same theme
- **Category ceilings** cap scores per area based on Board-configured weights
- The overnight run processes all new submissions together for consistent relative scoring

Submissions that have not yet been through overnight scoring show a **⏳** symbol in the score column and an amber notice in the sidebar.

### Score dimensions

The AI assesses each submission across six weighted dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| Member impact | 25% | How many members benefit, scaled by category ceiling |
| Strategic alignment | 20% | Fit with the club's strategic priorities |
| Feasibility | 20% | Realistic to implement at a private members club |
| Cost vs benefit | 15% | Estimated cost against benefit delivered |
| Novelty | 10% | Fresh idea vs standard practice already in place |
| Member experience delta | 10% | Material improvement to day-to-day experience |

### Multipliers

Certain factors multiply the weighted score (capped at 10.0):
- **H&S dimension:** ×1.5 — applied when the submission has a safety or compliance aspect
- **Budget year alignment:** ×1.2 — implementable in the current financial year
- **Cross-category:** ×1.1 — benefits span multiple categories

### Cluster bonus

When multiple submissions address the same specific issue, they are grouped into a cluster and each receives a consensus bonus:
- 2 in cluster: +0.5
- 3 in cluster: +1.0
- 4 in cluster: +1.5
- 5 or more: +2.0

### Score bands

| Band | Score range | Meaning |
|---|---|---|
| **Priority** | ≥ 8.0 | Under active consideration by relevant director |
| **Active queue** | ≥ 6.0 | To be reviewed at next Board cycle |
| **Holding** | ≥ 4.0 | Recorded for future consideration |
| **Low priority** | ≥ 2.0 | Below threshold for active progression |
| **Not progressed** | < 2.0 | Outside scope of programme |

> **Quick win override:** Regardless of score band, ideas that can be implemented within ~4 weeks at a cost under ~£500 are flagged as Quick Wins and may be actioned ahead of the standard review cycle.

> **Score override:** The Club Manager can manually override the AI score for any submission. See [Section 11](#11-score-override).

> **Thresholds are configurable** — the Club Manager can adjust all band thresholds, weights, and multipliers in the Admin panel.

---

## 7. Filters and sorting

### Search

The search box filters by **CIP number** (e.g. `CIP-0042` or just `42`), submission description, or member name. Results update as you type.

### Category filter

Filters by area of the club. Club Managers and Super Admins (who see all categories) can filter to a single area.

### Decision filter

Filters by current status — useful for reviewing only "Awaiting Decision" items, or finding all "Not Progressed" submissions.

### Flag filter

Filters by special attributes:
- ⚡ Quick wins
- ⚠ H&S flagged
- 💰 Revenue opportunities
- 🔁 Recurring themes
- 📋 In Plan
- £ Cost threshold (above Board escalation level)
- 🏛 Board review required

### Owner filter

Filters by suggested owner role, or shows only "Board submissions" (improvements submitted directly by directors).

### Sort

Three sort options available via toggle buttons:
- **Score** — highest first (default)
- **Decision** — grouped by status
- **Date** — most recent first

---

## 8. Managing submissions — the sidebar

All directors can access the Board Decision section in the sidebar for submissions in their categories. Decisions move through a ratification chain before becoming final.

### Decision authority hierarchy

| Role | Can act | Effect |
|---|---|---|
| **Director** | Recommend | Pending ratification by Operations Manager |
| **Operations Manager** | Ratify or override | Confirmed at ops level; routed to Club Manager |
| **Club Manager** | Ratify or override | Confirmed at manager level |
| **Chair of the Board** | Final decision | Cannot be overridden |

Once a higher authority has acted, lower roles cannot change the decision. The section becomes read-only with a note showing who set the decision.

### Spend limits and when ratification is required

Each authority level has a **spend limit** — the maximum confirmed cost they can finalise without escalation. If the confirmed cost exceeds your limit, the decision is passed up the chain regardless of your role.

When a Director or Operations Manager approves a submission and the cost is **within their spend limit**, the approval is still routed to the **Club Manager** for final sign-off before being considered fully approved. The ratification email explains this clearly.

If the cost **exceeds** your limit, the decision follows the standard escalation chain (Director → Operations Manager → Club Manager → Chair).

Spend limits are configured in the Admin panel under **Scoring Config → Director Spend Signoff Limits**.

### Ratification notifications

When anyone in the chain acts, the **next person in the chain** receives a direct email (To), and directors below them in the chain are copied (CC). The email includes:
- The improvement and the decision made
- Who made the change and their role
- What action is expected (ratify, review, or FYI only)
- Whether the lower-level spend limit has been satisfied

This ensures the right person knows they need to act, without creating confusion about who is responsible.

### Ratifying a decision

When a submission has been approved by a lower authority and you are the **next in the chain**, a green **"Ready to ratify"** callout appears in the sidebar. Click **Ratify this decision** to confirm and pass it up (or finalise it if you are the final authority).

> **You cannot ratify your own decision.** The Ratify button is hidden when you are the director who originally set the decision.

### How saving works

The sidebar uses a **draft model**. Make as many changes as you need across all fields, then click **Save** once. A single save:
- Updates all changed fields in the database in one operation
- Sends a status-change email to the member (if the status changed and they have an email address and have not opted out)
- Sends ratification notifications to the appropriate members of the chain
- Updates the audit trail

Nothing is saved and no emails are sent until you click Save.

### Member notification on full approval

When a submission's ratification chain is complete — the Chair or Club Manager has given final sign-off — the member receives a separate **"Fully Approved"** email from the Club Manager confirming that all required Board approvals are now in place. This is in addition to the initial status-change email they received when the Director first approved the submission.

### Reviewing emails before they are sent

Every status-change email is shown as a draft before it is sent. You can review and edit the AI-generated body, then click **OK to send** to dispatch it, or **Don't send** to save the status change without emailing the member.

If you prefer emails to be sent automatically without reviewing, tick **Auto-send without reviewing** in the sidebar.

### Status options

| Status | Use when |
|---|---|
| **Awaiting Decision** | Default — no decision made yet |
| **Under Consideration** | Actively being reviewed by the Board |
| **Approved** | Approved for implementation — pending action |
| **In Plan** | Included in the club improvement plan |
| **Implemented** | Completed |
| **Not Progressed** | Will not be taken forward at this time |

### Status change emails

When you save a status change, the member receives a **personalised, AI-generated email** reflecting the new status. The email:
- Is diplomatic and evidence-based
- Uses the AI assessment narrative as background context
- For **Not Progressed** only: also uses your Board notes as private context to craft a more specific explanation — the notes themselves are never quoted or sent to the member
- Never mentions internal scores, bands, weights, or process details

### Board review flag

Submissions assigned to the **Chair of the Board**, or those where the AI has flagged a cost threshold, are automatically marked with a 🏛 **Board review** badge in the table and sidebar. This acts as a soft reminder that the Chair should consider these at Board level before approving.

When the Chair moves a flagged submission to **In Plan**, the soft block is cleared and the decision is recorded.

### Prior decisions

During overnight scoring, the system checks whether any new submission is **substantially similar** to a previously not-progressed idea. If a match is found, an amber **"Prior decisions"** callout appears in the sidebar listing the earlier submission(s). Click any entry to view the full details of the prior submission in a popup — including the original description, AI narrative, Board notes, and score.

### Reviving a prior submission

When you progress a new submission (move it to Under Consideration or higher) and it has a linked prior submission, a **revival prompt** appears. You can choose to **Revive** the prior submission — which moves it back to Under Consideration so it can be reconsidered alongside the new one — or **Keep separate** to leave it as not progressed. Revival is available to managers who have access to all categories.

### Deleting a submission

> Only **Club Manager** and **Super Admin** can delete submissions.

The **✕ Remove** button in the sidebar soft-deletes the submission. It will no longer appear in the triage dashboard or the member's My Improvements view.

> **Cannot delete:** Submissions with status Approved or Implemented cannot be deleted — this preserves the audit trail.

### Changing category

Change the **Area** dropdown to reassign a submission to a different category. This changes which director sees it in the triage dashboard.

---

## 9. Target dates and confirmed cost

### Target date

- **AI suggested date** — calculated from the implementation time estimate (weeks), shown as a grey reference in the table
- **Confirmed target date** — set by the Club Manager in the sidebar; shown in green with a ✓ confirmed indicator in the table
- The confirmed target date is visible to the member in their My Improvements page and included in status-change emails

A "Use AI estimate" button appears when a suggested date exists but no confirmed date has been set.

### Confirmed cost

Set a confirmed cost target (£) to record the Board's agreed budget for an improvement. This is distinct from the AI cost estimate range and appears with a ✓ confirmed indicator in the table.

A "Use AI midpoint" button appears when an AI cost estimate exists but no confirmed cost has been set.

Both fields are saved as part of the panel Save — they do not save individually.

---

## 10. Board notes

Each submission has a **Notes** field in the sidebar, visible only to directors — never to members directly.

Use notes to record:
- Context or background from Board discussions
- Budget considerations
- Dependencies on other work
- Reasons for decisions

Notes are saved as part of the panel **Save changes** action.

> **Important:** Board notes are only ever used as **private background context** when generating a "Not Progressed" email. They help the AI write a more specific, evidence-based explanation. The notes are never quoted, paraphrased, or sent to the member for any other status. For all other statuses (Approved, Under Consideration, etc.) notes play no role in the email.

---

## 11. Score override

The Club Manager can override the AI-generated score for any submission if the Board believes the automated assessment does not reflect the full picture.

**To override a score:**
1. Open the submission sidebar
2. Find the **Score override** section (below the Board Decision panel)
3. Click **+ Override**
4. Enter the override score (0–10)
5. Enter a reason for the override (required)
6. Click **Save override**

The override score replaces the AI score for display and filtering purposes. The original AI score is preserved and visible alongside the override. All overrides are logged in the audit trail with the director's name, new score, and reason.

Score override has its own Save button and does not require the panel Save to be clicked.

---

## 12. Audit trail

Every submission has a complete audit trail recording every status change and score override. In the sidebar, scroll to the **Activity log** section.

Each entry shows:
- The new status (and previous status)
- Who made the change (director name)
- When it was made
- Any note (e.g. score override reason)

The audit trail cannot be edited or deleted.

---

## 13. Owner assignment

The AI scoring process recommends a **suggested owner** for each submission — the director role best placed to lead on implementation. This is shown as a 👤 badge on the submission row.

Use the **Owner** dropdown in the sidebar to assign or change the owner. Owner assignments are used in the Owner filter and help directors find submissions relevant to their role. They do not affect scoring or member communications.

Available owner roles:
- Golf Director
- Estate Director
- F&B Director
- Commercial Director
- Operations Manager
- Club Manager
- Chair of the Board

---

## 14. Tracking approved improvements

The **Tracking** tab shows all submissions with status **Approved** or **Implemented**. It provides a lightweight project tracking view with additional fields:

| Field | Purpose |
|---|---|
| **Target date** | Board-confirmed implementation date |
| **Responsible person** | Named individual leading the work |
| **Budget year** | Financial year in which cost falls |
| **Actual cost** | Recorded once implementation is complete |
| **Tracking notes** | Free-text updates on progress |

Click any row to expand it and edit these fields. Click **✓ Mark as implemented** to move an approved improvement to Implemented status.

---

## 15. Submitting an improvement as a director

Directors can submit improvement ideas directly from the triage dashboard. This is useful for:
- Recording management-initiated improvements for Board tracking
- Submitting ideas on behalf of members who raised something in passing

**To submit:**
1. Click **Submit an improvement** in the triage header
2. Complete the form as normal
3. Click **Submit improvement**
4. After submission, click **Back to triage** to return to the dashboard

Director-submitted improvements appear in the triage dashboard immediately (with ⏳ pending scoring) and are flagged as Board submissions in the Owner filter. They go through the same overnight scoring process as member submissions.

---

## 16. Email reports

### Weekly triage report

After each overnight scoring run, every director with **email reports enabled** receives a triage report email covering newly scored submissions in their assigned categories. The email includes H&S flagged items first, followed by all newly scored submissions with their AI summary and narrative.

### Immediate high-score alert

If any submission scores **9.0 or above** during a triage run, the relevant director receives an immediate alert email. This ensures high-priority ideas are not missed until the following week.

### H&S alert

If any submission is flagged with a Health & Safety dimension during triage, an **urgent alert** is sent immediately to the Club Manager.

### Enabling / disabling email reports

Each director's email report preference can be toggled in the Admin panel (Directors tab) using the **✉ Emails on / Emails off** button.

---

## 17. The member view

The member-facing **My Improvements** page shows each member their own submissions and their current status, score band, target date, and status history.

As a director, it is useful to understand what members see:
- Members **do not** see the numerical score
- Members **do not** see director notes
- Members **do not** see score dimensions, bands, weights, or internal process details
- Members **do** see the score band label and the Board message generated for them
- Members **do** see the confirmed target date (once set)
- Members **do** see a full status history timeline

---

## 18. Session security

- Director sessions last **8 hours** from sign-in
- An inactivity warning appears after **110 minutes** of no mouse or keyboard activity
- The session ends automatically after **120 minutes** of inactivity
- Any mouse movement, keystroke, click, or scroll resets the inactivity timer

---

## 19. Admin panel

The Admin panel is accessible to the **Club Manager** and **Super Admin** roles via the **Admin** link in the triage header.

---

### 19.1 Scoring Config

Controls all parameters that influence the AI scoring process. Changes take effect at the next overnight triage run.

**Triage schedule**
- **TRIAGE_INTERVAL_DAYS** — how many days between scoring runs (default: 7)

**Scoring weights** *(should sum to 1.0)*
- Member impact, Strategic alignment, Feasibility, Cost/benefit, Novelty, Experience delta

**Score multipliers**
- H&S, Budget year alignment, Multi-category span

**Score band thresholds** *(minimum score to reach each band)*
- Priority (≥ 8.0), Active (≥ 6.0), Holding (≥ 4.0), Low (≥ 2.0)

**Category impact ceilings** *(maximum member impact score per category)*
- Adjust to reflect the relative importance of each area to your membership

**Cluster consensus bonuses** *(additive bonus for clustered submissions)*
- Bonuses for cluster sizes 2, 3, 4, 5+

**Cost & implementation thresholds**
- Board escalation threshold (£) — above this cost, the cost_threshold flag is set
- Quick win cost threshold (£) — below this cost, the quick_win flag may be set
- Quick win implementation weeks — at or below this, the quick_win flag may be set

**Director spend signoff limits (£)**
The maximum confirmed cost each authority level can finalise without escalation. Set to `999999` for unlimited. If a submission's confirmed cost exceeds an authority's limit, the decision is automatically escalated to the next level in the chain.

| Authority | Default limit |
|---|---|
| Director | £0 (always escalates) |
| Operations Manager | £2,500 |
| Club Manager | £10,000 |
| Chair of the Board | Unlimited |

Click **Save changes** after editing any values.

---

### 19.2 Communications

Controls the tone of AI-generated emails sent to members when their submission status changes.

- **Communication tone:** Friendly (warm, personal) or Formal (professional, official)
- **Email sign-off:** The name used to sign off all member emails (e.g. "The Board, Bramley Golf Club")

Changes take effect immediately for all subsequent status-change emails.

---

### 19.3 Directors

Manage Board members and their access.

**Director list**

Each director is shown with their name, role, and email. Click a row to expand it. You can:
- **Toggle Active/Inactive** — inactive directors cannot sign in
- **Toggle Emails on/off** — controls whether they receive weekly triage report emails
- **Edit** — change name, email, or role
- **Reset PIN** — generates a new random 6-digit PIN shown once; communicate it to the director securely
- **Remove** — permanently deletes the director record

**Adding a director**

1. Enter the director's full name, email address, and role
2. Click **Add director**
3. A secure 6-digit PIN is generated automatically and shown once in an amber banner
4. Note the PIN and communicate it to the director securely — it cannot be retrieved again

**Reset all PINs**

The **Reset all PINs** button generates new PINs for all active directors at once and displays them in a table. Use this if PINs need to be rotated — for example at the start of a new season or after a security concern. Communicate the new PINs to each director securely before dismissing the panel.

> **Security:** PINs are never stored in plain text. The system stores only a cryptographic hash. If a PIN is lost, use **Reset PIN** or **Reset all PINs** to generate new ones.

---

### 19.4 Dashboard

A read-only overview of the programme's current state. Click **Refresh** to update.

**Summary statistics**
- Total scored submissions
- Average score across all scored submissions
- Number of quick wins
- Combined count of In Plan and Approved submissions

**Tables**
- Submissions by status (count)
- Submissions by category (count and average score)
- Score band distribution (count per band)

---

### 19.5 Setup

Operational tools for system administration.

#### Initialise database
Run once on first deployment and after any code update that adds new database columns. Safe to run repeatedly — existing data is never deleted, only missing tables and columns are added.

> **Always run this after a major update** before using the system.

#### Run triage now
Manually triggers the AI scoring batch immediately, rather than waiting for the automated overnight run. This will:
- Score all unscored submissions
- Detect and update clusters, applying score bonuses
- Send H&S alerts if needed
- Send high-score immediate alerts if any submission scores ≥ 9
- Send the weekly email report to all directors with email reports enabled

Allow 30–90 seconds for the process to complete.

#### Backup & restore

**Export CSV** — downloads all submissions as a CSV file, suitable for viewing in Excel.

**Full backup (JSON)** — downloads a complete snapshot of all tables. Use for disaster recovery. Store the file securely.

**Restore from CSV** — upload a previously exported CSV to restore or update submission records.

#### Test data

**Seed test data** — inserts pre-written test submissions covering all scenarios.

**Clear test data** — removes all test submissions cleanly.

#### Reset scores for re-triage

- **Reset test data only** — resets only test submissions
- **Reset all submissions** — resets every submission in the database

Use after changing scoring weights to re-score everything with the new configuration. After resetting, trigger a triage run.

> ⚠ **Caution:** "Reset all submissions" affects every record including real member data.

---

## 20. Budget management

The Budget tab in the Admin panel lets the Club Manager or Chair set up an annual miscellaneous expense pot and distribute it across categories.

### Setting up the budget

1. Go to **Admin → Budget**.
2. Select the financial year (runs July 1 – June 30).
3. Enter the **total budget** (£) for miscellaneous improvements.
4. Set each category's **percentage allocation** — these must sum to exactly 100%.
5. Click **Save budget**.

The live spend and remaining balance are shown next to each allocation and update automatically as submissions are approved.

### Budget checks on approval

When a director tries to approve a submission, the system checks whether the category has sufficient remaining budget:

- If funds are available, the approval proceeds normally.
- If funds are **exhausted** (the confirmed cost exceeds the remaining allocation), the approval is **blocked** and a modal appears.

The 🏦 badge on a row indicates a pending budget request for that submission.

### Requesting additional funds

When an approval is blocked:

1. Choose the request type:
   - **Overspend** — request extra budget from the overall pot for this category.
   - **Transfer** — propose moving funds from another category to this one.
2. Enter a justification explaining why the approval is important enough to warrant additional funds.
3. Click **Submit request**.

The Chair and Club Manager are notified by email immediately.

### Approving or declining requests

Budget requests appear under **Admin → Budget → Pending budget requests**.

- The request can be approved by whoever has signoff authority for the amount (using the same spend limit hierarchy as other decisions).
- If the amount exceeds the Club Manager's limit, it requires Chair approval.
- On approval of a transfer, allocations are adjusted automatically.
- The requesting director is notified by email of the decision.
- Once approved, the director can return to the submission and complete the approval.

---

## 21. Frequently asked questions

**A member says they never received a status-change email — what should I check?**
First confirm the submission has a member email address stored (visible in the DB or via the submission record). If the member opted out of emails at submission time, they won't receive updates for that submission. Also check that the status was saved (the Save button was clicked, not just the dropdown changed). Finally ask them to check spam for emails from the club's sending address.

**Can I see who submitted an anonymous idea?**
No. Anonymous submissions are displayed without member names and this cannot be overridden.

**A submission has been scored incorrectly — what can I do?**
Use the **Score override** feature to set a corrected score and record your reason. All overrides are logged in the audit trail.

**Can I move a submission to a different director's category?**
Yes. Use the **Area** dropdown in the sidebar and save.

**What does the ⏳ symbol mean on a submission?**
The submission has been received and an AI narrative generated, but it has not yet been through the overnight scoring run. It will be scored, clustered, and assigned in the next scheduled overnight run. You can still open and review the submission in the sidebar — it just won't have a score yet.

**Why do I have to click Save? Why doesn't it auto-save?**
Status changes trigger an AI-generated email to the member. The draft model ensures you can set the status, add Board notes, and confirm target dates all at once before anything is sent — preventing emails going out before you've finished making decisions.

**Are Board notes ever sent to members?**
Never directly. For a "Not Progressed" status only, the notes are used as private background context by the AI to write a more evidence-based explanation. The notes themselves are not quoted or forwarded — all other statuses ignore notes entirely when generating emails.

**What happens if two triage runs are triggered at the same time?**
The system uses an atomic lock to prevent concurrent triage runs. If a run is already in progress, any additional trigger is silently rejected.

**A director has left — how do I remove their access?**
Go to **Admin → Directors**, find their record, and click **Remove** to delete it. Alternatively click **Active** to toggle them to **Inactive** — this blocks sign-in but preserves their record in the audit trail.

**How do I add a new director?**
Go to **Admin → Directors → Add director**. Enter their name, email, and role. A PIN is generated automatically and shown once — communicate it securely before dismissing the banner.

**The database seems to be missing new columns after an update — what do I do?**
Go to **Admin → Setup → Initialise database** and click the button. This adds any missing columns without affecting existing data.

---

*Bramley Golf Club — Continuous Improvement Programme*
*For technical support, contact the system administrator*
*For programme queries, contact the Club Manager*
