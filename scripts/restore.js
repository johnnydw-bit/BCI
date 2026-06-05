/**
 * Bramley Golf Club CIP — Full JSON Restore Script
 * =================================================
 * Restores a full backup produced by Admin → Setup → Full backup (JSON).
 *
 * Usage:
 *   node scripts/restore.js <path-to-backup.json>
 *
 * Requirements:
 *   - Node.js installed
 *   - DATABASE_URL set in .env.local (or as an environment variable)
 *
 * The script upserts all data — existing records are updated, missing ones
 * are re-inserted. No records are deleted. Safe to run multiple times.
 *
 * PIN hashes are restored for directors. Any director whose record is
 * missing from the backup will need a PIN reset via the admin panel.
 */

const fs   = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Load DATABASE_URL from .env.local if present
// ---------------------------------------------------------------------------
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  console.log('Loaded environment from .env.local')
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.')
  console.error('Add it to .env.local or set it as an environment variable.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Load backup file
// ---------------------------------------------------------------------------
const backupPath = process.argv[2]
if (!backupPath) {
  console.error('Usage: node scripts/restore.js <path-to-backup.json>')
  process.exit(1)
}

const absolutePath = path.resolve(backupPath)
if (!fs.existsSync(absolutePath)) {
  console.error(`ERROR: File not found: ${absolutePath}`)
  process.exit(1)
}

let backup
try {
  backup = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
} catch (e) {
  console.error('ERROR: Could not parse backup file:', e.message)
  process.exit(1)
}

console.log(`\nBramley GC — Restore from backup`)
console.log(`File:        ${absolutePath}`)
console.log(`Exported at: ${backup.exported_at ?? 'unknown'}`)
console.log(`Exported by: ${backup.exported_by ?? 'unknown'}`)
console.log(`Version:     ${backup.version ?? 1}`)
console.log('')

// ---------------------------------------------------------------------------
// Connect to Neon
// ---------------------------------------------------------------------------
const { neon } = require('@neondatabase/serverless')
const sql = neon(DATABASE_URL)

// ---------------------------------------------------------------------------
// Helper: format a value for logging
// ---------------------------------------------------------------------------
function count(arr) {
  return Array.isArray(arr) ? arr.length : 0
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------
async function restore() {
  const { submissions = [], clusters = [], triage_runs = [], status_log = [], config = [], directors = [] } = backup

  console.log(`Records in backup:`)
  console.log(`  Submissions:  ${count(submissions)}`)
  console.log(`  Clusters:     ${count(clusters)}`)
  console.log(`  Triage runs:  ${count(triage_runs)}`)
  console.log(`  Status log:   ${count(status_log)}`)
  console.log(`  Config:       ${count(config)}`)
  console.log(`  Directors:    ${count(directors)}`)
  console.log('')

  // -- Config ----------------------------------------------------------------
  console.log('Restoring config...')
  let configCount = 0
  for (const row of config) {
    await sql`
      INSERT INTO config (key, value, label)
      VALUES (${row.key}, ${row.value}, ${row.label ?? null})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, label = COALESCE(EXCLUDED.label, config.label)
    `
    configCount++
  }
  console.log(`  ✓ ${configCount} config rows restored`)

  // -- Directors -------------------------------------------------------------
  console.log('Restoring directors...')
  let dirCount = 0
  for (const d of directors) {
    // Only restore pin_hash if present in backup (older backups may not have it)
    if (d.pin_hash) {
      await sql`
        INSERT INTO director_roles (id, pin_hash, role, name, email, active, email_reports)
        VALUES (${d.id}, ${d.pin_hash}, ${d.role}, ${d.name}, ${d.email}, ${d.active ?? true}, ${d.email_reports ?? true})
        ON CONFLICT (id) DO UPDATE SET
          role         = EXCLUDED.role,
          name         = EXCLUDED.name,
          email        = EXCLUDED.email,
          active       = EXCLUDED.active,
          email_reports = EXCLUDED.email_reports
      `
    } else {
      await sql`
        INSERT INTO director_roles (id, role, name, email, active, email_reports)
        VALUES (${d.id}, ${d.role}, ${d.name}, ${d.email}, ${d.active ?? true}, ${d.email_reports ?? true})
        ON CONFLICT (id) DO UPDATE SET
          role         = EXCLUDED.role,
          name         = EXCLUDED.name,
          email        = EXCLUDED.email,
          active       = EXCLUDED.active,
          email_reports = EXCLUDED.email_reports
      `
    }
    dirCount++
  }
  // Reset the sequence so new inserts don't clash
  if (directors.length > 0) {
    const maxId = Math.max(...directors.map((d) => d.id ?? 0))
    await sql`SELECT setval('director_roles_id_seq', ${maxId}, true)`
  }
  console.log(`  ✓ ${dirCount} directors restored`)

  // -- Clusters --------------------------------------------------------------
  console.log('Restoring clusters...')
  let clusterCount = 0
  for (const c of clusters) {
    await sql`
      INSERT INTO clusters (id, theme, category, size, created_at, updated_at)
      VALUES (${c.id}, ${c.theme}, ${c.category ?? null}, ${c.size ?? 1}, ${c.created_at ?? new Date().toISOString()}, ${c.updated_at ?? new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET
        theme      = EXCLUDED.theme,
        category   = EXCLUDED.category,
        size       = EXCLUDED.size,
        updated_at = EXCLUDED.updated_at
    `
    clusterCount++
  }
  if (clusters.length > 0) {
    const maxId = Math.max(...clusters.map((c) => c.id ?? 0))
    await sql`SELECT setval('clusters_id_seq', ${maxId}, true)`
  }
  console.log(`  ✓ ${clusterCount} clusters restored`)

  // -- Triage runs -----------------------------------------------------------
  console.log('Restoring triage runs...')
  let runCount = 0
  for (const r of triage_runs) {
    await sql`
      INSERT INTO triage_runs (id, run_at, period_start, period_end, next_run_at, submission_count, report_sent)
      VALUES (${r.id}, ${r.run_at}, ${r.period_start}, ${r.period_end}, ${r.next_run_at}, ${r.submission_count ?? 0}, ${r.report_sent ?? false})
      ON CONFLICT (id) DO UPDATE SET
        submission_count = EXCLUDED.submission_count,
        report_sent      = EXCLUDED.report_sent
    `
    runCount++
  }
  if (triage_runs.length > 0) {
    const maxId = Math.max(...triage_runs.map((r) => r.id ?? 0))
    await sql`SELECT setval('triage_runs_id_seq', ${maxId}, true)`
  }
  console.log(`  ✓ ${runCount} triage runs restored`)

  // -- Submissions -----------------------------------------------------------
  console.log('Restoring submissions (this may take a moment)...')
  let subCount = 0
  for (const s of submissions) {
    await sql`
      INSERT INTO submissions (
        id, member_id, member_name, recognition, description, benefit, category, impact,
        status, score, score_band, member_msg, h_and_s_flag, cluster_id, ai_summary, ai_narrative,
        cost_band, strategic_note, created_at, scored_at, triage_run_id,
        target_date, responsible_person, budget_year, actual_cost, tracking_notes,
        moderation_reason, cost_estimate_low, cost_estimate_high, cost_confidence, cost_rationale,
        impl_weeks_low, impl_weeks_high, impl_complexity, suggested_target_date,
        cost_threshold_flag, quick_win_flag, deleted_at, completed_at, recognition_flagged,
        member_email, email_opt_out, test_data,
        suggested_owner, needs_external_approval, approval_body,
        recurring_flag, recurring_run_count, seasonal_window,
        revenue_opportunity, revenue_note,
        notes, score_override, score_override_reason, score_override_by,
        confirmed_target_date, withdrawn_at
      ) VALUES (
        ${s.id}, ${s.member_id}, ${s.member_name ?? null}, ${s.recognition ?? 'anonymous'},
        ${s.description}, ${s.benefit}, ${s.category}, ${s.impact ?? 4},
        ${s.status ?? 'new'}, ${s.score ?? null}, ${s.score_band ?? null},
        ${s.member_msg ?? null}, ${s.h_and_s_flag ?? false},
        ${s.cluster_id ?? null}, ${s.ai_summary ?? null}, ${s.ai_narrative ?? null},
        ${s.cost_band ?? null}, ${s.strategic_note ?? null},
        ${s.created_at ?? new Date().toISOString()}, ${s.scored_at ?? null}, ${s.triage_run_id ?? null},
        ${s.target_date ?? null}, ${s.responsible_person ?? null}, ${s.budget_year ?? null},
        ${s.actual_cost ?? null}, ${s.tracking_notes ?? null}, ${s.moderation_reason ?? null},
        ${s.cost_estimate_low ?? null}, ${s.cost_estimate_high ?? null},
        ${s.cost_confidence ?? null}, ${s.cost_rationale ?? null},
        ${s.impl_weeks_low ?? null}, ${s.impl_weeks_high ?? null},
        ${s.impl_complexity ?? null}, ${s.suggested_target_date ?? null},
        ${s.cost_threshold_flag ?? false}, ${s.quick_win_flag ?? false},
        ${s.deleted_at ?? null}, ${s.completed_at ?? null}, ${s.recognition_flagged ?? false},
        ${s.member_email ?? null}, ${s.email_opt_out ?? false}, ${s.test_data ?? false},
        ${s.suggested_owner ?? null}, ${s.needs_external_approval ?? false}, ${s.approval_body ?? null},
        ${s.recurring_flag ?? false}, ${s.recurring_run_count ?? 0}, ${s.seasonal_window ?? null},
        ${s.revenue_opportunity ?? false}, ${s.revenue_note ?? null},
        ${s.notes ?? null}, ${s.score_override ?? null}, ${s.score_override_reason ?? null},
        ${s.score_override_by ?? null}, ${s.confirmed_target_date ?? null}, ${s.withdrawn_at ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        status                  = EXCLUDED.status,
        score                   = EXCLUDED.score,
        score_band              = EXCLUDED.score_band,
        member_msg              = EXCLUDED.member_msg,
        h_and_s_flag            = EXCLUDED.h_and_s_flag,
        cluster_id              = EXCLUDED.cluster_id,
        ai_summary              = EXCLUDED.ai_summary,
        ai_narrative            = EXCLUDED.ai_narrative,
        cost_band               = EXCLUDED.cost_band,
        cost_estimate_low       = EXCLUDED.cost_estimate_low,
        cost_estimate_high      = EXCLUDED.cost_estimate_high,
        cost_confidence         = EXCLUDED.cost_confidence,
        cost_rationale          = EXCLUDED.cost_rationale,
        impl_weeks_low          = EXCLUDED.impl_weeks_low,
        impl_weeks_high         = EXCLUDED.impl_weeks_high,
        impl_complexity         = EXCLUDED.impl_complexity,
        suggested_target_date   = EXCLUDED.suggested_target_date,
        confirmed_target_date   = EXCLUDED.confirmed_target_date,
        cost_threshold_flag     = EXCLUDED.cost_threshold_flag,
        quick_win_flag          = EXCLUDED.quick_win_flag,
        strategic_note          = EXCLUDED.strategic_note,
        suggested_owner         = EXCLUDED.suggested_owner,
        needs_external_approval = EXCLUDED.needs_external_approval,
        approval_body           = EXCLUDED.approval_body,
        recurring_flag          = EXCLUDED.recurring_flag,
        recurring_run_count     = EXCLUDED.recurring_run_count,
        seasonal_window         = EXCLUDED.seasonal_window,
        revenue_opportunity     = EXCLUDED.revenue_opportunity,
        revenue_note            = EXCLUDED.revenue_note,
        notes                   = EXCLUDED.notes,
        score_override          = EXCLUDED.score_override,
        score_override_reason   = EXCLUDED.score_override_reason,
        score_override_by       = EXCLUDED.score_override_by,
        deleted_at              = EXCLUDED.deleted_at,
        withdrawn_at            = EXCLUDED.withdrawn_at,
        scored_at               = EXCLUDED.scored_at,
        triage_run_id           = EXCLUDED.triage_run_id
    `
    subCount++
    if (subCount % 25 === 0) process.stdout.write(`  ${subCount}/${submissions.length}...\r`)
  }
  if (submissions.length > 0) {
    const maxId = Math.max(...submissions.map((s) => s.id ?? 0))
    await sql`SELECT setval('submissions_id_seq', ${maxId}, true)`
  }
  console.log(`  ✓ ${subCount} submissions restored    `)

  // -- Status log ------------------------------------------------------------
  console.log('Restoring status log...')
  let logCount = 0
  for (const l of status_log) {
    await sql`
      INSERT INTO status_log (id, submission_id, old_status, new_status, changed_by, note, changed_at)
      VALUES (${l.id}, ${l.submission_id}, ${l.old_status ?? null}, ${l.new_status}, ${l.changed_by}, ${l.note ?? null}, ${l.changed_at ?? new Date().toISOString()})
      ON CONFLICT (id) DO NOTHING
    `
    logCount++
  }
  if (status_log.length > 0) {
    const maxId = Math.max(...status_log.map((l) => l.id ?? 0))
    await sql`SELECT setval('status_log_id_seq', ${maxId}, true)`
  }
  console.log(`  ✓ ${logCount} status log entries restored`)

  console.log('\n✅ Restore complete.\n')
  console.log('Next steps:')
  console.log('  1. Open the app and verify submissions are visible in the triage report.')
  console.log('  2. Directors may need a PIN reset if their hash was not in the backup.')
  console.log('  3. Run "Initialise database" from Admin → Setup to ensure all columns exist.\n')
}

restore().catch((e) => {
  console.error('\n❌ Restore failed:', e.message)
  console.error(e)
  process.exit(1)
})
