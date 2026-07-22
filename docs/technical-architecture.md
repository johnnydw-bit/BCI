# Bramley Golf Club — Continuous Improvement Programme
## Technical Architecture Reference

*Version 1.0 — June 2026*

---

## Contents

1. [System overview](#1-system-overview)
2. [Technology stack](#2-technology-stack)
3. [Repository structure](#3-repository-structure)
4. [Application routes and pages](#4-application-routes-and-pages)
5. [API surface](#5-api-surface)
6. [Database schema](#6-database-schema)
7. [Authentication and session model](#7-authentication-and-session-model)
8. [Role and authority model](#8-role-and-authority-model)
9. [Submission lifecycle](#9-submission-lifecycle)
10. [AI scoring pipeline](#10-ai-scoring-pipeline)
11. [Email architecture](#11-email-architecture)
12. [Scheduled jobs (cron)](#12-scheduled-jobs-cron)
13. [Configuration system](#13-configuration-system)
14. [Environment variables](#14-environment-variables)
15. [Database migrations](#15-database-migrations)
16. [Key design decisions](#16-key-design-decisions)

---

## 1. System overview

The CIP is a **Next.js 15 App Router** web application deployed on Vercel. It has three distinct user-facing surfaces:

| Surface | URL path | Who uses it |
|---|---|---|
| **Member submission** | `/submit` | Any club member (unauthenticated) |
| **Member portal** | `/my-improvements` | Members who have submitted (cookie-based) |
| **Director triage** | `/triage` | Directors, authenticated by PIN |
| **Admin panel** | `/admin` | Club Manager and Super Admin only |
| **Board login** | `/board` | Entry point for director PIN login |

All application logic runs server-side via Next.js API Route Handlers (`app/api/**`). There are no external backend services — the application, database, AI calls, and email sending all originate from Vercel Edge/Node functions.

---

## 2. Technology stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | TypeScript throughout |
| **Styling** | Tailwind CSS | No component library |
| **Database** | PostgreSQL via Neon (serverless) | `@neondatabase/serverless` HTTP driver |
| **ORM / query** | Tagged template literals (`sql\`...\``) | No ORM — raw SQL via `lib/db.ts` |
| **AI** | Anthropic Claude API | `claude-sonnet-4-6` for scoring; `claude-haiku-4-5` for moderation and emails |
| **Email** | Resend | `resend` SDK |
| **Auth** | Custom JWT | `jose` library; no third-party auth provider |
| **Hosting** | Vercel | Serverless functions; cron via `vercel.json` |
| **Source control** | GitHub | Private repository `johnnydw-bit/BCI` |

### Why no ORM?

The schema is stable and the query patterns are straightforward. Raw SQL keeps the bundle lean and avoids the abstraction overhead of Prisma or Drizzle for a project of this scale. All queries are parameterised via the tagged template driver (preventing SQL injection).

---

## 3. Repository structure

```
BCI/
├── app/
│   ├── page.tsx                    # Root redirect
│   ├── board/page.tsx              # Director PIN login
│   ├── submit/page.tsx             # Member submission form
│   ├── my-improvements/page.tsx    # Member portal
│   ├── triage/page.tsx             # Director triage dashboard (main UI)
│   ├── admin/page.tsx              # Admin panel
│   ├── setup/page.tsx              # First-run setup
│   └── api/
│       ├── submit/                 # Member submission handler
│       ├── auth/                   # Member and director auth
│       ├── triage/                 # GET/PATCH/DELETE for submissions
│       ├── triage/audit/           # Audit log for a submission
│       ├── tracking/               # Tracking tab data
│       ├── my-suggestions/         # Member portal data + withdrawal
│       ├── director-session/       # Director session check
│       ├── session/                # Member session check
│       └── admin/
│           ├── init-db/            # Run database migrations
│           ├── run-triage/         # Manual triage trigger
│           ├── directors/          # CRUD for director records
│           ├── config/             # Read/write scoring config
│           ├── dashboard/          # Admin dashboard stats
│           ├── export-csv/         # CSV export
│           ├── export-full/        # Full JSON backup
│           ├── import-csv/         # CSV restore
│           ├── reset-scores/       # Reset scores for re-triage
│           ├── seed-test-data/     # Insert test submissions
│           ├── clear-test-data/    # Remove test submissions
│           └── cron/
│               ├── triage/         # Overnight scoring cron endpoint
│               └── backup/         # Weekly backup email cron endpoint
├── lib/
│   ├── db.ts                       # Database connection + initDb() migrations
│   ├── auth.ts                     # JWT sign/verify helpers
│   ├── ai.ts                       # Claude API calls (scoring, moderation, emails)
│   ├── email.ts                    # Resend email sending functions
│   ├── categories.ts               # Category definitions, role helpers, authority model
│   └── triage.ts                   # Core triage/scoring logic
├── docs/                           # All documentation
├── scripts/
│   └── restore.js                  # Offline JSON backup restore script
├── public/                         # Static assets
└── vercel.json                     # Cron job schedule + function config
```

---

## 4. Application routes and pages

### `/submit` — Member submission form

Fully unauthenticated. Members provide their membership number and name, which are stored against the submission. A short AI narrative is generated immediately and shown on-screen. No login required; submissions are linked by `member_id` (membership number).

### `/my-improvements` — Member portal

Cookie-based session from the submission form. Shows the member's own submissions with status history. Members see: score band label, Board message, confirmed target date, and status timeline. They do **not** see: numerical scores, director notes, or internal process details.

### `/board` — Director login

PIN entry form. On success, sets a `bci_director_session` cookie (signed JWT). Redirects to `/triage`.

### `/triage` — Director triage dashboard

The main working view. Renders server-side with the initial data fetch; subsequent interactions (open sidebar, save changes, load audit trail) are client-side fetch calls to `/api/triage`. The entire triage page is a single large React component (`app/triage/page.tsx`).

Key client-side state:
- `data` — full submissions array from the API (source of truth for panel lookups)
- `selected` — currently open submission ID
- `draft` — local copy of editable fields, pending save
- `auditLog` — per-submission audit history, fetched on panel open

### `/admin` — Admin panel

Gated to `isManager` roles. Five tabs: Setup, Communications, Directors, Dashboard, Application Management.

---

## 5. API surface

All routes are under `app/api/`. Authentication is checked at the start of every handler.

### Member-facing

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/submit` | None | Create new submission, trigger AI narrative |
| GET | `/api/session` | Member cookie | Check member session |
| GET | `/api/my-suggestions` | Member cookie | Return member's own submissions |
| POST | `/api/my-suggestions/withdraw` | Member cookie | Withdraw a submission |
| POST | `/api/auth/login` | None | Member login (membership number) |
| POST | `/api/auth/logout` | None | Clear member session cookie |

### Director-facing

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/triage` | Director session | Return all submissions for director's categories |
| PATCH | `/api/triage` | Director session | Update submission fields (status, owner, notes, etc.) |
| DELETE | `/api/triage` | Director session + isManager | Soft-delete a submission |
| GET | `/api/triage/audit` | Director session | Audit log for a given submission ID |
| GET | `/api/tracking` | Director session | Return approved/implemented submissions |
| PATCH | `/api/tracking` | Director session | Update tracking fields |
| GET | `/api/director-session` | Director session | Validate director session + return role/name |
| POST | `/api/auth/director` | None | Director PIN login |

### Admin-only

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/init-db` | isManager | Run all database migrations |
| POST | `/api/admin/run-triage` | isManager | Manually trigger triage run |
| GET/POST/PATCH/DELETE | `/api/admin/directors` | isManager | CRUD for director records |
| GET/POST | `/api/admin/config` | isManager | Read/write scoring config |
| GET | `/api/admin/dashboard` | isManager | Aggregated statistics |
| GET | `/api/admin/export-csv` | isManager | Export submissions as CSV |
| GET | `/api/admin/export-full` | isManager | Export full JSON backup |
| POST | `/api/admin/import-csv` | isManager | Restore from CSV |
| POST | `/api/admin/reset-scores` | isManager | Reset scores for re-triage |
| POST | `/api/admin/seed-test-data` | isManager | Insert test data |
| POST | `/api/admin/clear-test-data` | isManager | Remove test data |

### Cron endpoints

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/cron/triage` | Vercel cron secret | Overnight scoring run |
| GET | `/api/cron/backup` | Vercel cron secret | Weekly backup email |

Cron endpoints are protected by the `CRON_SECRET` environment variable, which Vercel injects automatically into the `Authorization` header on scheduled calls.

---

## 6. Database schema

All tables are in a single Neon PostgreSQL database. The schema is managed by `initDb()` in `lib/db.ts` — see [Section 15](#15-database-migrations).

### `submissions`

The primary table. Every member idea is a row.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `member_id` | TEXT | Membership number |
| `member_name` | TEXT | Name at submission time |
| `member_email` | TEXT | Email at submission time |
| `email_opt_out` | BOOLEAN | Set by member at submission |
| `recognition` | TEXT | `named` or `anonymous` |
| `description` | TEXT | Original submission text |
| `benefit` | TEXT | Member's stated benefit |
| `category` | TEXT | One of the 9 category values |
| `impact` | INTEGER | Self-assessed impact (2/4/6/8) |
| `status` | TEXT | `new`, `under_consideration`, `approved`, `implemented`, `rejected`, `in_plan` |
| `score` | NUMERIC(4,2) | AI-generated score 0–10 |
| `score_band` | TEXT | `priority`, `active`, `holding`, `low`, `not_progressed` |
| `score_override` | NUMERIC(4,2) | Manual override (nullable) |
| `score_override_reason` | TEXT | Required when override set |
| `score_override_by` | TEXT | Director name |
| `h_and_s_flag` | BOOLEAN | AI-detected safety dimension |
| `cluster_id` | INTEGER | FK → clusters |
| `ai_summary` | TEXT | Short AI-generated title |
| `ai_narrative` | TEXT | Full AI assessment prose |
| `member_msg` | TEXT | AI-generated message shown to member at submission |
| `cost_band` | TEXT | AI cost estimate band |
| `cost_estimate_low` | NUMERIC | AI lower bound (£) |
| `cost_estimate_high` | NUMERIC | AI upper bound (£) |
| `cost_confidence` | TEXT | AI confidence level |
| `cost_rationale` | TEXT | AI cost reasoning |
| `impl_weeks_low` | INTEGER | AI implementation estimate (weeks) |
| `impl_weeks_high` | INTEGER | |
| `impl_complexity` | TEXT | AI complexity label |
| `suggested_target_date` | DATE | AI-calculated from impl estimate |
| `confirmed_target_date` | DATE | Board-confirmed target |
| `confirmed_cost` | NUMERIC | Board-confirmed budget (£) |
| `strategic_note` | TEXT | AI strategic alignment note |
| `suggested_owner` | TEXT | AI-recommended owner role |
| `notes` | TEXT | Board-internal notes (never sent to member) |
| `decision_authority` | TEXT | Authority level of last decision-maker |
| `decision_by` | TEXT | Name of last decision-maker |
| `needs_external_approval` | BOOLEAN | AI flag |
| `approval_body` | TEXT | Which external body |
| `recurring_flag` | BOOLEAN | Seen in multiple triage runs |
| `recurring_run_count` | INTEGER | |
| `seasonal_window` | TEXT | AI-identified seasonal timing |
| `revenue_opportunity` | BOOLEAN | AI flag |
| `revenue_note` | TEXT | |
| `quick_win_flag` | BOOLEAN | Set by scoring pipeline |
| `cost_threshold_flag` | BOOLEAN | Exceeds Board escalation threshold |
| `moderation_reason` | TEXT | Why submission was moderation-rejected |
| `test_data` | BOOLEAN | Identifies seeded test submissions |
| `created_at` | TIMESTAMPTZ | |
| `scored_at` | TIMESTAMPTZ | When overnight scoring ran |
| `deleted_at` | TIMESTAMPTZ | Soft delete |
| `withdrawn_at` | TIMESTAMPTZ | Member withdrawal |
| `completed_at` | TIMESTAMPTZ | |
| `triage_run_id` | INTEGER | FK → triage_runs |

### `clusters`

Groups submissions addressing the same theme.

| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `theme` | TEXT |
| `category` | TEXT |
| `size` | INTEGER |
| `created_at`, `updated_at` | TIMESTAMPTZ |

### `status_log`

Immutable audit trail. Every status change and score override is an insert.

| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `submission_id` | INTEGER FK |
| `old_status` | TEXT |
| `new_status` | TEXT |
| `changed_by` | TEXT |
| `note` | TEXT |
| `changed_at` | TIMESTAMPTZ |

### `director_roles`

Director accounts and access configuration.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `pin_hash` | TEXT UNIQUE | bcrypt hash of 6-digit PIN |
| `pin` | TEXT | Plaintext shown once on creation (then cleared) |
| `role` | TEXT | See role list in Section 8 |
| `name` | TEXT | |
| `email` | TEXT | |
| `active` | BOOLEAN | Inactive = cannot sign in |
| `email_reports` | BOOLEAN | Receives weekly triage report |

### `triage_runs`

Scheduling state for the scoring pipeline.

| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `run_at` | TIMESTAMPTZ |
| `period_start`, `period_end` | TIMESTAMPTZ |
| `next_run_at` | TIMESTAMPTZ |
| `submission_count` | INTEGER |
| `report_sent` | BOOLEAN |

### `member_preferences`

Cross-submission member identity store (email + name by membership number).

| Column | Type |
|---|---|
| `member_id` | TEXT PK |
| `email` | TEXT |
| `member_name` | TEXT |
| `created_at`, `updated_at` | TIMESTAMPTZ |

### `config`

Key-value store for all runtime configuration. Seeded with defaults on first run.

| Column | Type |
|---|---|
| `key` | TEXT PK |
| `value` | TEXT |
| `label` | TEXT |

### `login_attempts`

Rate-limiting table for director PIN login.

| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `ip` | TEXT |
| `identifier` | TEXT |
| `attempted_at` | TIMESTAMPTZ |

Index on `(ip, identifier, attempted_at)` for fast lookups.

---

## 7. Authentication and session model

### Member sessions

Members authenticate by entering their membership number. On success, a `bci_session` cookie is set containing a signed JWT (`jose` HS256). The JWT contains `memberId`, `memberName`, `email`, and `emailOptOut`. Sessions expire after 24 hours.

The `/submit` route does not require authentication — a session is created or refreshed at submission time.

### Director sessions

Directors authenticate by entering a 6-digit PIN. PIN hashes are stored in `director_roles.pin_hash` using bcrypt. On success, a `bci_director_session` cookie is set containing a signed JWT. The JWT contains `directorId`, `role`, `directorName`, `email`, and `type: 'director'`. Sessions expire after 8 hours.

**Inactivity timeout:** The triage page polls the session endpoint. After 110 minutes of inactivity (no user events), a warning modal appears. After 120 minutes, the session is expired client-side and the user is redirected to the login screen. Activity (mouse, keyboard, scroll) resets the timer.

**Rate limiting:** Five failed PIN attempts within 15 minutes from the same IP+identifier locks the account for 15 minutes. The `login_attempts` table stores each attempt. Cleanup of old attempts runs on each login check.

### Session verification

`lib/auth.ts` exports `verifySession(token)` which decodes and validates the JWT. Every API handler calls this before processing — there is no middleware layer; the check is per-route.

---

## 8. Role and authority model

### Roles

Defined in `lib/categories.ts` via `DIRECTOR_CATEGORIES`:

| Role | Category access |
|---|---|
| Golf Director | Course, Competitions & Matches |
| Estate Director | Clubhouse, Grounds, On-course Refreshments |
| F&B Director | Restaurant, Bar, On-course Refreshments |
| Commercial Director | Pro Shop |
| Operations Manager | All categories |
| Club Manager | All categories |
| Chair of the Board | All categories |
| Super Admin | All categories |

### Manager check

`isManager(role)` returns true for: Operations Manager, Club Manager, Chair of the Board, Super Admin. Managers can change statuses, assign owners, override scores, and (for Club Manager / Super Admin) access the Admin panel.

### Ratification / decision authority hierarchy

Implemented via `AUTHORITY_LEVELS`, `roleToAuthority()`, and `canOverrideAuthority()` in `lib/categories.ts`.

| Authority key | Level | Mapped from role(s) |
|---|---|---|
| `director` | 1 | Golf, Estate, F&B, Commercial Director |
| `operations_manager` | 2 | Operations Manager |
| `club_manager` | 3 | Club Manager, Super Admin |
| `chairman` | 4 | Chair of the Board |

When a director saves a status change, `decision_authority` is written to the submission row. `canOverrideAuthority(role, currentAuthority)` returns true only if the acting user's level is ≥ the stored level. Level 4 decisions are final and cannot be overridden by anyone.

---

## 9. Submission lifecycle

```
Member submits
     │
     ▼
POST /api/submit
     │── Moderation check (Claude haiku): is it appropriate?
     │   └─ If rejected: stored with moderation_reason, deleted_at set
     │── AI narrative generated (Claude haiku): pros/considerations/commercial
     │── member_msg generated (short member-facing summary)
     │── Stored in submissions with status = 'new', scored_at = NULL
     │── Confirmation email sent to member (Resend)
     │
     ▼
Overnight cron (Monday 07:00 UTC)
     │── Fetch all unscored submissions (scored_at IS NULL)
     │── For each submission:
     │   ├─ Score across 6 dimensions (Claude sonnet)
     │   ├─ Apply category ceiling, multipliers
     │   ├─ Detect cluster membership / create new cluster
     │   └─ Apply cluster bonus to all submissions in cluster
     │── Update submissions: score, score_band, ai_summary, ai_narrative, flags, scored_at
     │── Update triage_runs record
     │── Send weekly email report to directors with email_reports = TRUE
     │── Send immediate alert for any score ≥ 9
     │── Send H&S alert to Club Manager if any h_and_s_flag = TRUE
     │
     ▼
Director views in triage dashboard
     │
     ▼
Director opens sidebar → saves changes
     │── Authority check (canOverrideAuthority)
     │── Update submission fields
     │── Log to status_log
     │── If status changed:
     │   ├─ Send AI-generated status email to member (if not opted out)
     │   └─ Send ratification notification to chain members
     │── Update decision_authority + decision_by on submission
     │
     ▼
Member views update in /my-improvements
```

---

## 10. AI scoring pipeline

All AI calls are in `lib/ai.ts`. Two Claude models are used:

**`claude-haiku-4-5`** — fast, cheap, used for:
- Submission moderation (is this appropriate?)
- Member-facing narrative at submission time
- AI-generated status-change emails

**`claude-sonnet-4-6`** — higher quality, used for:
- Full scoring across 6 dimensions
- Cost estimation
- Implementation time estimation
- Cluster detection
- Strategic notes

### Scoring formula

Each submission receives a single score between 0.0 and 10.0. The calculation has four stages.

#### Stage 1 — Six dimension scores (0–10 each)

The model scores each submission on six dimensions. Descriptions below are the actual instructions given to the model:

| Dimension | Config weight key | Description |
|---|---|---|
| `member_impact` | `WEIGHT_MEMBER_IMPACT` | Start from the member's self-assessed impact score, capped at the category ceiling. The model may adjust ±2 points: down for vague/directional suggestions that cannot be acted on without further data; up for ideas with clear benefit the member may have underestimated. |
| `strategic_alignment` | `WEIGHT_STRATEGIC` | How well does it align with typical golf club strategic priorities. |
| `feasibility` | `WEIGHT_FEASIBILITY` | Realistic for a private members golf club to implement. Score HIGH (8–10) for ideas requiring no capital spend, no external approval, and achievable within days by existing staff. Score LOW for planning permission, major procurement, or operationally impractical ideas. |
| `cost_benefit` | `WEIGHT_COST_BENEFIT` | Likely cost band vs benefit delivered. A zero-cost quick-win scores 9–10. |
| `novelty` | `WEIGHT_NOVELTY` | Not an obvious standard practice already in place. |
| `experience_delta` | `WEIGHT_EXPERIENCE_DELTA` | Material improvement to day-to-day member experience. |

**Category ceilings** — the `member_impact` dimension is capped at a per-category maximum before the model applies its ±2 adjustment. Ceilings are stored in `config` under `CEILING_<CATEGORY>` keys (e.g. `CEILING_COURSE`, `CEILING_RESTAURANT`). Submissions in high-impact categories (course, restaurant) have higher ceilings than lower-priority categories.

**Vague submissions** — if a suggestion is directional rather than specific (e.g. "reduce competitions" without a concrete proposal), the model reduces `member_impact` by 1–2 points and notes this in `ai_narrative`. The Board cannot act on direction alone.

#### Stage 2 — Weighted composite score

```
weighted_score = Σ (dimension_score × dimension_weight)
```

Weights are read at runtime from the `config` table. They should sum to 1.0 (enforced by the Admin → Setup panel validation). Default weights are:

| Dimension | Default weight |
|---|---|
| member_impact | 30% |
| strategic_alignment | 20% |
| feasibility | 15% |
| cost_benefit | 15% |
| novelty | 10% |
| experience_delta | 10% |

#### Stage 3 — Multipliers (applied sequentially, capped at 10.0)

After weighting, three multipliers may be applied. Each is read from `config`:

| Condition | Config key | Default | Rule |
|---|---|---|---|
| H&S flag | `MULT_HS` | 1.5× | Set only for genuine active safety risks (trip hazards, structural/electrical safety, fire safety, food hygiene violations, immediate danger). Not set for suggestions that merely mention "safety" or represent good practice without an existing risk. |
| Budget year alignment | `MULT_BUDGET_YEAR` | 1.1× | Implementable within the current financial year. |
| Spans multiple categories | `MULT_MULTI_CATEGORY` | 1.05× | The submission touches more than one category area. |

Multipliers stack multiplicatively: e.g. a submission with H&S flag and budget-year alignment scores `weighted_score × 1.5 × 1.1`. The result is capped at 10.0.

#### Stage 4 — Cluster bonus (additive, post-cap)

When two or more submissions describe the same specific problem or improvement area, they are assigned a shared `cluster_theme`. The cluster bonus is added to each member's score after the 10.0 cap:

| Cluster size | Config key | Default bonus |
|---|---|---|
| 2 submissions | `CLUSTER_BONUS_2` | +0.3 |
| 3 submissions | `CLUSTER_BONUS_3` | +0.5 |
| 4 submissions | `CLUSTER_BONUS_4` | +0.7 |
| 5+ submissions | `CLUSTER_BONUS_5` | +1.0 |

Clustering requires the same *specific* problem — not merely the same broad theme. "Two suggestions about shower facilities in the changing rooms" clusters; "a shower request and a locker request" does not, even though both are facilities.

The final `score` stored in `submissions` is the post-bonus value, still capped at 10.0.

### Band assignment

The final score maps to a `score_band` using thresholds from the `config` table:

| Band | Config key | Default threshold |
|---|---|---|
| `priority` | `BAND_PRIORITY` | ≥ 8.0 |
| `active` | `BAND_ACTIVE` | ≥ 6.0 |
| `holding` | `BAND_HOLDING` | ≥ 4.0 |
| `low` | `BAND_LOW` | ≥ 2.0 |
| `not_progressed` | — | < 2.0 (or below BAND_LOW) |

Band thresholds are configurable. A score override (`score_override`) replaces the AI score for band assignment but the original AI score is preserved in the `score` column.

### Scoring prompt inputs

The scoring prompt receives:
- Submission description and benefit text
- Member-assessed impact level and category ceiling
- Current config weights and multipliers (fetched from `config` table at run time)
- Previously not-progressed submissions in the same category (for novelty scoring and prior-rejection detection)

### Scoring is idempotent within a run

The triage lock (`TRIAGE_LOCK` config key) prevents concurrent runs. If a run is already in progress, a new trigger is silently rejected. The lock is set to `true` at run start and `false` at completion (including on error, via try/finally).

---

## 11. Email architecture

All email is sent via Resend. Sending functions are in `lib/email.ts`.

### Email types

| Trigger | Recipients | Template |
|---|---|---|
| Member submission | Member | Confirmation + AI narrative |
| Status change | Member | AI-generated personalised email |
| Ratification notification | All chain members except actor | Amber (pending) or green (ratified) |
| Triage report | Directors (email_reports = TRUE) | Weekly digest of newly scored submissions |
| High-score alert | Relevant director | Immediate alert for score ≥ 9 |
| H&S alert | Club Manager | Immediate alert for H&S flagged item |
| Weekly backup | Club Manager | CSV attachment |

### Ratification notification logic

When a status is saved, `sendRatificationNotification()` is called with:
- `recipients` — all active directors with emails, filtered to: (a) all senior roles (Operations Manager, Club Manager, Chair of the Board) and (b) category directors covering the submission's category, excluding the actor
- The notification shows the decision made, who made it, their role, and who is next expected to act (or "final" if Chair acted)

### Member email personalisation

Status-change emails are generated by Claude (`generateStatusEmail()`) using:
- Submission description, benefit, AI narrative
- New status and status label
- Confirmed target date (if set)
- Communication tone and sign-off (from `config` table)
- For "Not Progressed" only: board notes as private context

The email body is fully AI-generated prose — not a template with substitution variables.

---

## 12. Scheduled jobs (cron)

Defined in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/triage", "schedule": "0 7 * * 1" },
    { "path": "/api/cron/backup", "schedule": "0 6 * * 0" }
  ]
}
```

| Job | Schedule | What it does |
|---|---|---|
| Triage | Monday 07:00 UTC | Score unscored submissions, send reports |
| Backup | Sunday 06:00 UTC | Email CSV backup to Club Manager |
| Owner nudge | Monday 08:00 UTC | Email directors who have had an assigned submission with no status change for 14+ days |

Both endpoints verify the Vercel `CRON_SECRET` before executing. They can also be triggered manually from Admin → Setup.

---

## 13. Configuration system

All tunable parameters are stored in the `config` table as key-value pairs. The Admin panel's Setup tab reads and writes these values. Default values are seeded by `initDb()` and are never overwritten on subsequent runs (`ON CONFLICT DO NOTHING`).

Key groups:

| Prefix | Controls |
|---|---|
| `TRIAGE_*` | Run interval, concurrency lock |
| `WEIGHT_*` | Scoring dimension weights (should sum to 1.0) |
| `MULT_*` | Score multipliers (H&S, budget year, multi-category) |
| `BAND_*` | Score band thresholds |
| `CEILING_*` | Per-category member impact ceilings |
| `CLUSTER_BONUS_*` | Cluster consensus bonuses |
| `COST_THRESHOLD_*` | Quick win and escalation thresholds |
| `IMPL_QUICKWIN_WEEKS` | Implementation time threshold for quick win flag |
| `COMMS_*` | Email tone and sign-off |

---

## 14. Environment variables

Stored in Vercel project settings. Required for all environments:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `RESEND_API_KEY` | Resend email API key |
| `JWT_SECRET` | Signs member and director session tokens |
| `MANAGER_EMAIL` | Receives backup emails and H&S alerts |
| `EMAIL_FROM` | Sending address (must be verified in Resend) |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://bramley-bci.vercel.app`) |
| `CRON_SECRET` | Authenticates Vercel cron calls |

Optional:

| Variable | Purpose |
|---|---|
| `DEBUG_EMAIL` | If set, all emails are redirected to this address (dev/test use) |

---

## 15. Database migrations

There is no migration framework. Migrations are `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements inside `initDb()` in `lib/db.ts`. This function:

- Creates all tables with `CREATE TABLE IF NOT EXISTS`
- Adds all columns with `ADD COLUMN IF NOT EXISTS`
- Seeds `config` defaults with `ON CONFLICT DO NOTHING`

It is **idempotent and safe to run repeatedly** — no data is deleted, no existing columns are modified. It should be run after every deployment that adds new database columns, via **Admin → Setup → Initialise database** or `POST /api/admin/init-db`.

The function is not called automatically on application start in production (to avoid cold-start latency). `ensureDb()` is exported for routes that need to guarantee the schema is current, but most routes assume the schema is up to date.

### Adding a new column

1. Add the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` line to `initDb()` in `lib/db.ts`
2. Deploy the code
3. Run **Admin → Setup → Initialise database** on the live instance

---

## 16. Key design decisions

### Draft model in the triage sidebar

All sidebar fields are held in a local React `draft` state. Nothing is sent to the API until the user clicks **Save**. This is intentional — status changes trigger member emails, so the board needs to be able to set status, add notes, and confirm target dates as a single atomic action before anything is sent.

### Panel lookup from full `data.submissions`

The sidebar panel is always looked up from the full unfiltered `data.submissions` array, not from the filtered/sorted view. This prevents the panel closing when a status change moves the submission out of the current filter view.

### Soft deletes

Submissions are never hard-deleted. `deleted_at` (for manager removal) and `withdrawn_at` (for member withdrawal) timestamps are set instead. The triage query filters on `deleted_at IS NULL AND withdrawn_at IS NULL`. This preserves the audit trail and allows data recovery.

### No ORM / no migration framework

The schema evolves via additive `IF NOT EXISTS` migrations only. Columns are never renamed or dropped in-place (a new column is added and the old one abandoned if needed). This keeps migrations safe and the `initDb()` function simple and fully readable.

### JWT over database sessions

Sessions are stored entirely in signed JWTs on the client cookie — there is no sessions table to query. This keeps the database lean and eliminates the need for session cleanup jobs. The trade-off is that tokens cannot be individually revoked before expiry; PIN reset or role change takes effect at the user's next login.

### Category filtering at the query level

Directors only receive submissions for their assigned categories. This is enforced in the SQL `WHERE s.category = ANY(${allowedCategories})` clause using the `DIRECTOR_CATEGORIES` map, not in application code after fetching all rows. This keeps data access aligned with role permissions at the data layer.

### Ratification authority is stored on the submission

`decision_authority` is written to the `submissions` row on every save. This means the authority check on subsequent edits is a simple integer comparison without needing to query the `status_log`. The authoritative record of who acted and when is in `status_log`; `decision_authority` / `decision_by` on the submission row is the live locking state.

---

*Bramley Golf Club — Continuous Improvement Programme*
*Technical reference — for developer use*
*Update this document when making significant architectural changes*
