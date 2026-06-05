import { neon } from '@neondatabase/serverless'

let _db: ReturnType<typeof neon> | null = null

function db() {
  if (!_db) _db = neon(process.env.DATABASE_URL!)
  return _db
}

type Row = Record<string, unknown>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql = ((...args: any[]) => (db() as any)(...args)) as (
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
) => Promise<Row[]>

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id            SERIAL PRIMARY KEY,
      member_id     TEXT NOT NULL,
      member_name   TEXT,
      recognition   TEXT NOT NULL DEFAULT 'anonymous',
      description   TEXT NOT NULL,
      benefit       TEXT NOT NULL,
      category      TEXT NOT NULL,
      impact        INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'new',
      score         NUMERIC(4,2),
      score_band    TEXT,
      member_msg    TEXT,
      h_and_s_flag  BOOLEAN NOT NULL DEFAULT FALSE,
      cluster_id    INTEGER,
      ai_summary    TEXT,
      ai_narrative  TEXT,
      cost_band     TEXT,
      strategic_note TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scored_at     TIMESTAMPTZ,
      triage_run_id INTEGER
    )
  `

  // Tracking fields
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_date DATE`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS responsible_person TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS budget_year INTEGER`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2)`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tracking_notes TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS moderation_reason TEXT`

  // Cost estimation fields
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_estimate_low NUMERIC(10,2)`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_estimate_high NUMERIC(10,2)`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_confidence TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_rationale TEXT`

  // Implementation time fields
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS impl_weeks_low INTEGER`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS impl_weeks_high INTEGER`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS impl_complexity TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS suggested_target_date DATE`

  // Flags
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_threshold_flag BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS quick_win_flag BOOLEAN NOT NULL DEFAULT FALSE`

  // Soft delete + completion
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS recognition_flagged BOOLEAN NOT NULL DEFAULT FALSE`

  // Member email + opt-out stored at submission time (from login session)
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS member_email TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE`

  // Test data flag — allows bulk seeding and clearing for testing
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS test_data BOOLEAN NOT NULL DEFAULT FALSE`

  // Extended flags — v2
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS suggested_owner TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS needs_external_approval BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS approval_body TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS recurring_flag BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS recurring_run_count INTEGER NOT NULL DEFAULT 0`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS seasonal_window TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS revenue_opportunity BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS revenue_note TEXT`

  // Member preferences — stores verified email against member ID
  await sql`
    CREATE TABLE IF NOT EXISTS member_preferences (
      member_id   TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS clusters (
      id          SERIAL PRIMARY KEY,
      theme       TEXT NOT NULL,
      category    TEXT,
      size        INTEGER NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS triage_runs (
      id            SERIAL PRIMARY KEY,
      run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      period_start  TIMESTAMPTZ NOT NULL,
      period_end    TIMESTAMPTZ NOT NULL,
      next_run_at   TIMESTAMPTZ NOT NULL,
      submission_count INTEGER NOT NULL DEFAULT 0,
      report_sent   BOOLEAN NOT NULL DEFAULT FALSE
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS status_log (
      id            SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      old_status    TEXT,
      new_status    TEXT NOT NULL,
      changed_by    TEXT NOT NULL,
      note          TEXT,
      changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS director_roles (
      id          SERIAL PRIMARY KEY,
      pin_hash    TEXT NOT NULL UNIQUE,
      role        TEXT NOT NULL,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      active      BOOLEAN NOT NULL DEFAULT TRUE
    )
  `
  await sql`ALTER TABLE director_roles ADD COLUMN IF NOT EXISTS email_reports BOOLEAN NOT NULL DEFAULT TRUE`
  await sql`ALTER TABLE director_roles ADD COLUMN IF NOT EXISTS pin TEXT`

  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `

  const defaults: [string, string, string][] = [
    ['TRIAGE_INTERVAL_DAYS',      '7',    'Days between triage runs'],
    ['WEIGHT_MEMBER_IMPACT',      '0.25', 'Scoring weight: member impact (0–1)'],
    ['WEIGHT_STRATEGIC',          '0.20', 'Scoring weight: strategic alignment (0–1)'],
    ['WEIGHT_FEASIBILITY',        '0.20', 'Scoring weight: feasibility (0–1)'],
    ['WEIGHT_COST_BENEFIT',       '0.15', 'Scoring weight: cost/benefit ratio (0–1)'],
    ['WEIGHT_NOVELTY',            '0.10', 'Scoring weight: novelty (0–1)'],
    ['WEIGHT_EXPERIENCE_DELTA',   '0.10', 'Scoring weight: member experience delta (0–1)'],
    ['MULT_HS',                   '1.5',  'Multiplier: H&S flag'],
    ['MULT_BUDGET_YEAR',          '1.2',  'Multiplier: aligns with current budget year'],
    ['MULT_MULTI_CATEGORY',       '1.1',  'Multiplier: spans multiple categories'],
    ['BAND_PRIORITY',             '8.0',  'Score threshold: Priority band (≥ this value)'],
    ['BAND_ACTIVE',               '6.0',  'Score threshold: Active queue band (≥ this value)'],
    ['BAND_HOLDING',              '4.0',  'Score threshold: Holding band (≥ this value)'],
    ['BAND_LOW',                  '2.0',  'Score threshold: Low priority band (≥ this value)'],
    ['CEILING_COURSE',            '10',   'Category impact ceiling: Course'],
    ['CEILING_COMPETITIONS',      '7',    'Category impact ceiling: Competitions & Matches'],
    ['CEILING_CLUBHOUSE',         '8',    'Category impact ceiling: Clubhouse'],
    ['CEILING_GROUNDS',           '6',    'Category impact ceiling: Grounds'],
    ['CEILING_REFRESHMENTS',      '4',    'Category impact ceiling: On-course Refreshments'],
    ['CEILING_RESTAURANT',        '5',    'Category impact ceiling: Restaurant / Catering'],
    ['CEILING_BAR',               '6',    'Category impact ceiling: Bar'],
    ['CEILING_PRO_SHOP',          '3',    'Category impact ceiling: Pro Shop'],
    ['CLUSTER_BONUS_2',           '0.5',  'Consensus bonus: cluster of 2'],
    ['CLUSTER_BONUS_3',           '1.0',  'Consensus bonus: cluster of 3'],
    ['CLUSTER_BONUS_4',           '1.5',  'Consensus bonus: cluster of 4'],
    ['CLUSTER_BONUS_5',           '2.0',   'Consensus bonus: cluster of 5+'],
    ['COST_THRESHOLD_COMMITTEE',  '5000',  'Cost threshold (£): above this, escalate to full committee review'],
    ['COST_THRESHOLD_QUICKWIN',   '500',   'Cost threshold (£): below this, flag as quick win'],
    ['IMPL_QUICKWIN_WEEKS',       '4',     'Implementation weeks: at or below this = quick win'],
    ['TRIAGE_LOCK',               'false', 'Internal: prevents concurrent triage runs'],
  ]

  for (const [key, value, _label] of defaults) {
    await sql`
      INSERT INTO config (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO NOTHING
    `
  }

  // Store labels for admin UI
  await sql`
    ALTER TABLE config ADD COLUMN IF NOT EXISTS label TEXT
  `
  for (const [key, _value, label] of defaults) {
    await sql`UPDATE config SET label = ${label} WHERE key = ${key} AND label IS NULL`
  }
}
