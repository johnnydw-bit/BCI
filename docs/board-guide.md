# Bramley Golf Club â€” Continuous Improvement Programme
## Board & Director Guide

*Version 1.0 â€” June 2026*

---

## Contents

1. [Programme overview](#1-programme-overview)
2. [Roles and access levels](#2-roles-and-access-levels)
3. [Installing the app](#3-installing-the-app)
4. [Signing in](#4-signing-in)
5. [The triage report](#5-the-triage-report)
6. [Understanding scores and bands](#6-understanding-scores-and-bands)
7. [Views â€” Card view and Spreadsheet view](#7-views--card-view-and-spreadsheet-view)
8. [Filters and search](#8-filters-and-search)
9. [Managing submissions](#9-managing-submissions)
10. [Target dates](#10-target-dates)
11. [Director notes](#11-director-notes)
12. [Score override](#12-score-override)
13. [Audit trail](#13-audit-trail)
14. [Owner assignment](#14-owner-assignment)
15. [Tracking approved improvements](#15-tracking-approved-improvements)
16. [Email reports](#16-email-reports)
17. [My Improvements â€” the member view](#17-my-improvements--the-member-view)
18. [Session security](#18-session-security)
19. [Super Admin â€” Admin panel](#19-super-admin--admin-panel)
20. [Frequently asked questions](#20-frequently-asked-questions)

---

## 1. Programme overview

The Continuous Improvement Programme (CIP) collects, scores, and prioritises member improvement ideas using an AI-assisted structured assessment process. The workflow is:

1. **Member submits** an idea via the programme website
2. **Automated moderation** checks the submission for appropriateness
3. **Weekly AI scoring** assesses every unscored submission across six weighted dimensions and produces a score out of 10
4. **Triage report** presents scored submissions to directors for decision
5. **Directors act** â€” change statuses, assign owners, set target dates
6. **Members are notified** automatically by email when the status of their idea changes

The system is designed to ensure every submission is treated fairly and consistently, reducing the administrative burden on the Board while maintaining full accountability.

---

## 2. Roles and access levels

| Role | Sees in triage | Can change status / assign owner | Admin panel |
|---|---|---|---|
| **Golf Director** | Course, Competitions & Matches | No | No |
| **Estate Director** | Clubhouse, Grounds, On-course Refreshments | No | No |
| **F&B Director** | Restaurant, Bar, On-course Refreshments | No | No |
| **Commercial Director** | Pro Shop | No | No |
| **Operations Manager** | All categories | No | No |
| **Chairman / Chair** | All categories | No | No |
| **Club Manager** | All categories | **Yes** | **Yes** |
| **Super Admin** | All categories | **Yes** | **Yes** (full access) |

> **Note:** Only the Club Manager and Super Admin can change submission statuses, assign owners, delete submissions, or access the Admin panel. All other roles have read-only access to their relevant categories.

---

## 3. Installing the app

The Board portal can be installed on your device so it opens like a native app â€” no browser address bar or tabs.

**The Board URL is:** `https://bcg-cip.vercel.app/Board`

**Chrome (Desktop â€” Windows or Mac)**
1. Open Chrome and go to `https://bcg-cip.vercel.app/Board`
2. Look for the install icon (âŠ•) in the address bar, far right
3. Click it and select **Install**
4. The app will open in its own window and appear in your taskbar / applications

**Android (Chrome)**
1. Open Chrome and navigate to `https://bcg-cip.vercel.app/Board`
2. Tap the three-dot menu (â‹®) in the top right
3. Tap **Add to Home screen**
4. Confirm the name and tap **Add**
5. The app icon will appear on your home screen

**iPhone / iPad (Safari)**
1. Open Safari and navigate to `https://bcg-cip.vercel.app/Board`
2. Tap the Share button (the box with an arrow pointing up) at the bottom of the screen
3. Scroll down and tap **Add to Home Screen**
4. Confirm the name and tap **Add**
5. The app icon will appear on your home screen

> **Tip:** Installing the app gives the best experience â€” it opens full screen with no browser chrome, ideal for use on a tablet during Board meetings.

---

## 4. Signing in

Directors sign in using a **6-digit PIN** assigned by the Club Manager.

**Steps:**
1. Open the app or go to `https://bcg-cip.vercel.app/Board`
2. Enter your PIN
3. Click **Sign in**

> **Forgotten your PIN?** Contact the Club Manager who can reset your PIN from the Admin panel. A new PIN will be generated and communicated to you.

> **Locked out?** After 5 failed attempts, access is locked for 15 minutes. This is a security measure.

> **Sessions:** Director sessions last 8 hours. In the triage report, an inactivity warning appears after 110 minutes and you are signed out automatically at 120 minutes. Move your mouse or press a key to reset the inactivity timer.

---

## 5. The triage report

After signing in, you are taken directly to the **Triage Report** â€” the main working view for directors.

### What you see

The triage report shows all submissions in your assigned categories that have not been deleted or withdrawn, ordered by:
1. Health & Safety flagged items (always at the top)
2. Score (highest first)
3. Date submitted (most recent first for equal scores)

### Summary bar

At the top of the report, a summary bar shows counts of submissions by status â€” Awaiting Decision, Under Consideration, Approved, In Plan, Implemented, Not Progressed. Click any status chip to filter by that status.

### Submission cards

Each submission card shows:
- **Status badge** â€” current status with colour coding
- **Score** â€” out of 10, with score band
- **Flags** â€” âš ï¸ H&S, âš¡ Quick win, ðŸ’° Revenue opportunity, ðŸ”„ Recurring theme, â¬† High cost, ðŸ‘¤ Suggested owner
- **Category** and submission date
- **Description** and AI summary
- **Cost estimate** (lowâ€“high range) and implementation complexity
- **Cluster** â€” if this submission has been grouped with similar ideas

Click a card to expand it and see full detail, including the AI narrative, suggested owner, cost rationale, strategic note, and audit trail.

---

## 6. Understanding scores and bands

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
- **H&S dimension:** Ã—1.5 â€” applied when submission has a safety or compliance aspect
- **Budget year alignment:** Ã—1.2 â€” implementable in the current financial year
- **Cross-category:** Ã—1.1 â€” benefits span multiple categories

### Cluster bonus

When multiple submissions address the same specific issue, they are grouped into a cluster and each receives a consensus bonus added to the score:
- 2 in cluster: +0.5
- 3 in cluster: +1.0
- 4 in cluster: +1.5
- 5 or more: +2.0

### Score bands

| Band | Score range | Board label |
|---|---|---|
| **Priority** | â‰¥ 8.0 | Under active consideration by relevant director |
| **Active queue** | â‰¥ 6.0 | To be reviewed at next Board cycle |
| **Holding** | â‰¥ 4.0 | Recorded for future consideration |
| **Low priority** | â‰¥ 2.0 | Below threshold for active progression |
| **Not progressed** | < 2.0 | Outside scope of programme |

> **Quick win override:** Regardless of score band, ideas that can be implemented within ~4 weeks at a cost under ~Â£500 are flagged as Quick Wins and may be actioned ahead of schedule.

> **Score override:** The Club Manager can manually override the AI score for any submission. See [Section 11](#11-score-override).

> **Thresholds are configurable** â€” the Club Manager can adjust all band thresholds, weights, and multipliers in the Admin panel.

---

## 7. Views â€” Card view and Spreadsheet view

The triage report offers two views, switchable via the toggle buttons (â˜° / âŠž) in the top right of the report. Your preference is saved automatically.

### Card view (âŠž)

The default view. Each submission is shown as a detailed card with all flags, badges, cost information, and expandable AI narrative. Best for reviewing individual submissions in depth.

### Spreadsheet view (â˜°)

A compact table showing one row per submission. Columns include: score, status, category, AI summary, cost band, implementation complexity, owner, and flags. Click any row to open a side panel with full detail.

The spreadsheet view is better for:
- Getting an overview of all submissions quickly
- Comparing scores across submissions
- Bulk decision-making

---

## 8. Filters and search

### Search

Type any text in the search box to filter submissions by description, benefit, AI summary, or member name (if named recognition was chosen).

### Status filter

Click any status chip in the summary bar to show only submissions with that status. Click again to clear.

### Flag filter

The **Flags** dropdown filters by special attributes:
- âš¡ Quick wins
- âš ï¸ H&S flagged
- ðŸ’° Revenue opportunities
- ðŸ”„ Recurring themes
- ðŸ“‹ In Plan
- â¬† Cost threshold (above Board escalation threshold)

### Owner filter

The **Owner** dropdown filters by the suggested owner role, showing only submissions assigned to a particular director.

### Category filter

The **Category** dropdown (visible to Club Manager / Super Admin who see all categories) filters by category.

### Withdrawn toggle

Withdrawn submissions are hidden by default. Tick **Show withdrawn** to include them in the view.

---

## 9. Managing submissions

> Only the **Club Manager** and **Super Admin** can perform the actions in this section.

### Changing status

In a submission card or the spreadsheet side panel, use the **Status** dropdown to change the status. The following statuses are available:

| Status | Use when |
|---|---|
| **Awaiting Decision** | Default â€” no decision made yet |
| **Under Consideration** | Actively being reviewed by the Board |
| **In Plan** | Included in the club improvement plan |
| **Approved** | Approved for implementation â€” pending action |
| **Implemented** | Completed |
| **Not Progressed** | Will not be taken forward at this time |

When you change status to **Under Consideration**, **Approved**, or **In Plan**, you will be prompted to enter a **target date**. This is optional but recommended â€” if the AI has suggested a target date, it will be pre-filled for your convenience.

> **Member notification:** When you change a submission's status, the member automatically receives a personalised email generated by AI. The email reflects the new status and (if set) the target date. **Your internal director notes are never included in member emails.**

### Deleting a submission

The **Delete** option (trash icon) permanently soft-deletes a submission. It will no longer appear in the triage report or in the member's My Improvements view.

> **Cannot delete:** Submissions with status **Approved** or **Implemented** cannot be deleted â€” this preserves the audit trail for actioned improvements.

### Changing category

If a submission has been placed in the wrong category, use the **Category** dropdown to reassign it. This also changes which director sees it in the triage report.

---

## 10. Target dates

Target dates represent the Board's committed timeline for a submission.

- **AI suggested date** is calculated from the implementation time estimate (weeks) and shown as a grey reference in the triage view
- **Confirmed target date** is set by the Club Manager when changing status â€” shown in green with a âœ“ confirmed indicator
- The confirmed target date is visible to the member in their My Improvements page

To set or update a target date without changing status, open the submission detail panel and edit the **Confirmed target date** field directly.

---

## 11. Director notes

Each submission has a **Notes** field visible only to directors â€” never to members.

Use notes to record:
- Context or background from Board discussions
- Budget considerations
- Dependencies on other work
- Any decisions made outside the system

Notes are saved automatically when you click away from the text field. They are included in the full JSON backup but not in any member-facing communications.

---

## 12. Score override

The Club Manager can override the AI-generated score for any submission if the Board believes the automated assessment doesn't reflect the full picture.

**To override a score:**
1. Open the submission detail panel
2. Find the **Score override** section
3. Enter the override score (0â€“10)
4. Enter a reason for the override
5. Click **Apply**

The override score replaces the AI score for display and filtering purposes. The original AI score is preserved and visible alongside the override. All overrides are logged in the audit trail with the director's name, new score, and reason.

---

## 13. Audit trail

Every submission has a complete audit trail recording every status change and score override. To view it:

1. Open a submission (click to expand in card view, or click a row in spreadsheet view)
2. Scroll to the **Audit trail** section

Each entry shows:
- The previous status
- The new status
- Who made the change (director name)
- When it was made
- Any note (e.g. score override reason)

The audit trail cannot be edited or deleted.

---

## 14. Owner assignment

The AI scoring process recommends a suggested owner for each submission â€” the director role best placed to lead on implementation. This is shown as a ðŸ‘¤ badge on the submission card.

**To assign or change the owner:**
- In card view: use the **Owner** dropdown inside the expanded submission
- In spreadsheet view: use the inline **Owner** dropdown in the table row, or the side panel

Owner assignments are used in the **Owner filter** to help directors find submissions relevant to their role. They do not affect scoring or member communications.

Available owner roles:
- Golf Director
- Estate Director
- F&B Director
- Commercial Director
- Club Manager
- Chairman

---

## 15. Tracking approved improvements

The **Tracking** tab in the triage report shows all submissions with status **Approved** or **Implemented**. It provides a lightweight project tracking view with additional fields:

| Field | Purpose |
|---|---|
| **Target date** | Board-confirmed implementation date |
| **Responsible person** | Named individual leading the work |
| **Budget year** | Financial year in which cost falls |
| **Actual cost** | Recorded once implementation is complete |
| **Tracking notes** | Free-text updates on progress |

Click the edit icon on any tracked improvement to update these fields.

---

## 16. Email reports

### Weekly triage report

After each scoring run (Monday mornings), every director with **email reports enabled** receives a triage report email covering submissions in their assigned categories. The email includes H&S flagged items first, followed by all newly scored submissions with their AI summary and narrative.

The email also contains a link to the full interactive triage report.

### Immediate high-score alert

If any submission scores **9.0 or above** during a triage run, the relevant director receives an immediate alert email (in addition to the weekly report). This ensures high-priority ideas are not missed until the following week.

### H&S alert

If any submission is flagged with a Health & Safety dimension during triage, an **urgent alert** is sent immediately to the Club Manager.

### Enabling / disabling email reports

Each director's email report preference can be toggled in the Admin panel (Directors tab) using the **âœ‰ Emails on / Emails off** button.

---

## 17. My Improvements â€” the member view

The member-facing **My Improvements** page shows each member their own submissions and their current status, score band, target date, and status history. Members can also withdraw submissions from this page.

As a director, it is useful to understand what members see so you can set expectations appropriately:
- Members **do not** see the numerical score
- Members **do not** see director notes
- Members **do** see the score band label and Board message
- Members **do** see the confirmed target date (once set)
- Members **do** see a full status history timeline

---

## 18. Session security

- Director sessions last **8 hours** from sign-in
- In the triage report, an inactivity warning appears after **110 minutes** of no mouse or keyboard activity
- The session ends automatically after **120 minutes** of inactivity â€” you are redirected to the sign-in page
- Any mouse movement, keystroke, click, or scroll resets the inactivity timer

---

## 19. Super Admin â€” Admin panel

The Admin panel is accessible to the **Club Manager** and **Super Admin** roles. It is reached via the **Admin** link in the triage report header.

The Admin panel has five tabs:

---

### 18.1 Scoring Config

Controls all parameters that influence the AI scoring process. Changes take effect at the next triage run.

**Triage schedule**
- **TRIAGE_INTERVAL_DAYS** â€” how many days between scoring runs (default: 7)

**Scoring weights** *(should sum to 1.0)*
- Member impact, Strategic alignment, Feasibility, Cost/benefit, Novelty, Experience delta

**Score multipliers**
- H&S, Budget year alignment, Multi-category span

**Score band thresholds** *(minimum score to reach each band)*
- Priority (â‰¥ 8.0), Active (â‰¥ 6.0), Holding (â‰¥ 4.0), Low (â‰¥ 2.0)

**Category impact ceilings** *(maximum member impact score per category)*
- Adjust these to reflect the relative importance of each area to your membership

**Cluster consensus bonuses** *(additive bonus for clustered submissions)*
- Bonuses for cluster sizes 2, 3, 4, 5+

**Cost & implementation thresholds**
- Board escalation threshold (Â£) â€” above this cost, the cost_threshold flag is set
- Quick win cost threshold (Â£) â€” below this cost, the quick_win flag may be set
- Quick win implementation weeks â€” at or below this, the quick_win flag may be set

Click **Save changes** after editing any values.

---

### 18.2 Communications

Controls the tone of AI-generated emails sent to members when their submission status changes.

- **Communication tone:** Friendly (warm, personal) or Formal (professional, official)
- **Email sign-off:** The name used to sign off all member emails (e.g. "The Improvement Board, Bramley Golf Club")

Changes take effect immediately for all subsequent status-change emails.

---

### 18.3 Directors

Manage Board members and their access.

**Director list**

Each director is shown with their name, role, and email. You can:
- **Toggle Active/Inactive** â€” inactive directors cannot sign in
- **Toggle Emails on/off** â€” controls whether they receive weekly triage report emails
- **Edit** â€” change name, email, or role
- **Reset PIN** â€” generates a new random 6-digit PIN shown once; communicate it to the director securely
- **Remove** â€” permanently deletes the director record

**Adding a director**

1. Enter the director's full name, email address, and role
2. Click **Add director**
3. A secure 6-digit PIN is generated automatically and shown once in an amber banner
4. Note the PIN and communicate it to the director securely â€” it cannot be retrieved again

> **Security:** PINs are never stored in plain text. The system stores only a cryptographic hash. If a PIN is lost, use **Reset PIN** to generate a new one.

---

### 18.4 Dashboard

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

### 18.5 Setup

Operational tools for system administration.

#### Initialise database
Run once on first deployment and after any code update that adds new database columns. Safe to run repeatedly â€” existing data is never deleted, only missing tables and columns are added.

> **Always run this after a major update** before using the system.

#### Run triage now
Manually triggers the AI scoring batch immediately, rather than waiting for the automated Monday morning run. This will:
- Score all unscored submissions
- Detect and update clusters
- Send H&S alerts if needed
- Send high-score immediate alerts if any submission scores â‰¥ 9
- Send the weekly email report to all directors with email reports enabled

Allow 30â€“90 seconds for the process to complete. Do not navigate away during the run.

#### Backup & restore

**Export CSV** â€” downloads all submissions as a CSV file. Suitable for viewing in Excel or restoring submissions only.

**Full backup (JSON)** â€” downloads a complete snapshot of all tables (submissions, clusters, triage runs, status log, config, directors). Use this for disaster recovery. Store the file securely.

**Restore from CSV** â€” upload a previously exported CSV to restore or update submission records. Existing records are updated; missing records are re-inserted. No records are deleted.

> **Full JSON restore:** If you need to restore from a full JSON backup (e.g. after a major incident), use the standalone restore script: `node scripts/restore.js <backup-file.json>` from the project folder on your computer. See the technical documentation for details.

#### Test data

**Seed test data** â€” inserts 12 pre-written test submissions covering all scenarios. Use this to test the scoring process without real member data. Test submissions are clearly flagged.

**Clear test data** â€” removes all test submissions cleanly. Orphaned clusters and triage run references are also cleaned up.

#### Reset scores for re-triage

Use these buttons to clear all AI scores and re-queue submissions for the next triage run. Two scopes:

- **Reset test data only** â€” resets only test submissions
- **Reset all submissions** â€” resets every submission in the database

This is useful if you have changed scoring weights and want to re-score everything with the new configuration. After resetting, trigger a triage run to re-score.

> âš ï¸ **Caution:** "Reset all submissions" affects every record including real member data. Confirm carefully before proceeding.

---

## 20. Frequently asked questions

**A member says they never received an email â€” what should I check?**
First ask them to check their spam or junk folder for emails from `noreply@bramleygolfclub.co.uk`. If they opted out of emails at submission time, they won't receive updates for that submission. Opt-out is per submission, not global.

**Can I see who submitted an anonymous idea?**
No. Anonymous submissions are displayed without member names. This is intentional and cannot be overridden in the current version.

**A submission has been scored incorrectly â€” what can I do?**
Use the **Score override** feature to set a corrected score and record your reason. All overrides are logged in the audit trail. Alternatively, reset the submission's score and re-run triage (note this re-scores all unscored submissions, not just one).

**Can I move a submission to a different director's category?**
Yes. Use the **Category** dropdown in the submission detail to reassign it. The submission will then appear in the relevant director's triage view.

**What happens if two triage runs are triggered at the same time?**
The system uses an atomic lock to prevent concurrent triage runs. If a run is already in progress, any additional trigger (cron or manual) is silently rejected. The lock is always released when the run completes or fails.

**How do I know if the cron job is running?**
The triage report shows the date of the last triage run and the next scheduled run. If the next run date is in the past, the cron may not be running â€” check the Vercel dashboard for cron job status.

**Can I change the day or time of the automated triage run?**
Yes â€” edit `vercel.json` in the project repository to change the cron schedule. The current schedule is Monday at 07:00 UTC.

**A director has left â€” how do I remove their access?**
Go to **Admin â†’ Directors**, find their record, and click **Remove** to delete it entirely. Alternatively, click **Active** to toggle them to **Inactive** â€” this blocks sign-in but preserves their record in the audit trail.

**How do I add a new director?**
Go to **Admin â†’ Directors â†’ Add director**. Enter their name, email, and role. A PIN is generated automatically and shown once â€” communicate it to the director securely before dismissing the banner.

**Is there a way to see all submissions including deleted and withdrawn ones?**
Deleted submissions are permanently soft-deleted and not visible in the triage view. Withdrawn submissions can be shown by ticking **Show withdrawn** in the triage filters.

**The database seems to be missing new columns after an update â€” what do I do?**
Go to **Admin â†’ Setup â†’ Initialise database** and click the button. This adds any missing columns without affecting existing data. This should be done after every code deployment that includes database changes.

---

*Bramley Golf Club â€” Continuous Improvement Programme*
*For technical support, contact the system administrator*
*For programme queries, contact the Club Manager*

