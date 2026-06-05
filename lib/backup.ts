// Columns exported/imported in backup CSV — order matters for parsing
const COLUMNS = [
  'id', 'member_id', 'member_name', 'recognition',
  'description', 'benefit', 'category', 'impact',
  'status', 'score', 'score_band', 'member_msg',
  'h_and_s_flag', 'ai_summary', 'ai_narrative',
  'cost_band', 'cost_estimate_low', 'cost_estimate_high', 'cost_confidence', 'cost_rationale',
  'impl_complexity', 'impl_weeks_low', 'impl_weeks_high', 'suggested_target_date',
  'cost_threshold_flag', 'quick_win_flag',
  'suggested_owner', 'needs_external_approval', 'approval_body',
  'recurring_flag', 'recurring_run_count', 'seasonal_window',
  'revenue_opportunity', 'revenue_note', 'strategic_note',
  'recognition_flagged', 'member_email', 'email_opt_out',
  'moderation_reason', 'created_at', 'scored_at',
]

function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function generateBackupCsv(rows: Record<string, unknown>[]): string {
  const header = COLUMNS.join(',')
  const lines = rows.map((row) =>
    COLUMNS.map((col) => escapeCsv(row[col])).join(',')
  )
  return [header, ...lines].join('\r\n')
}

export function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  // Parse header
  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter((r) => r.id && r.id !== '')
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"'
          i += 2
        } else if (line[i] === '"') {
          i++ // skip closing quote
          break
        } else {
          field += line[i++]
        }
      }
      result.push(field)
      if (line[i] === ',') i++ // skip comma
    } else {
      // Unquoted field
      const end = line.indexOf(',', i)
      if (end === -1) {
        result.push(line.slice(i))
        break
      } else {
        result.push(line.slice(i, end))
        i = end + 1
      }
    }
  }
  return result
}
