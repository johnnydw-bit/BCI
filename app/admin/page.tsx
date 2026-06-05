'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BramleyHeader from '@/components/BramleyHeader'

const ROLES = ['Club Manager', 'Super Admin', 'Operations Manager', 'Chairman', 'Chair', 'Golf Director', 'Estate Director', 'F&B Director', 'Commercial Director']

const CONFIG_GROUPS = [
  {
    title: 'Triage Schedule',
    keys: ['TRIAGE_INTERVAL_DAYS'],
  },
  {
    title: 'Scoring Weights',
    note: 'Should sum to 1.0',
    keys: ['WEIGHT_MEMBER_IMPACT', 'WEIGHT_STRATEGIC', 'WEIGHT_FEASIBILITY', 'WEIGHT_COST_BENEFIT', 'WEIGHT_NOVELTY', 'WEIGHT_EXPERIENCE_DELTA'],
  },
  {
    title: 'Score Multipliers',
    keys: ['MULT_HS', 'MULT_BUDGET_YEAR', 'MULT_MULTI_CATEGORY'],
  },
  {
    title: 'Score Band Thresholds',
    note: 'Minimum score to reach each band (out of 10)',
    keys: ['BAND_PRIORITY', 'BAND_ACTIVE', 'BAND_HOLDING', 'BAND_LOW'],
  },
  {
    title: 'Category Impact Ceilings',
    note: 'Maximum member impact score per category',
    keys: ['CEILING_COURSE', 'CEILING_COMPETITIONS', 'CEILING_CLUBHOUSE', 'CEILING_GROUNDS', 'CEILING_REFRESHMENTS', 'CEILING_RESTAURANT', 'CEILING_BAR', 'CEILING_PRO_SHOP'],
  },
  {
    title: 'Cluster Consensus Bonuses',
    note: 'Additive bonus applied when submissions form a cluster',
    keys: ['CLUSTER_BONUS_2', 'CLUSTER_BONUS_3', 'CLUSTER_BONUS_4', 'CLUSTER_BONUS_5'],
  },
  {
    title: 'Cost & Implementation Thresholds',
    note: 'Used to flag quick wins and escalate high-cost items',
    keys: ['COST_THRESHOLD_QUICKWIN', 'COST_THRESHOLD_COMMITTEE', 'IMPL_QUICKWIN_WEEKS'],
  },
]

interface ConfigRow { key: string; value: string; label: string }
interface Director { id: number; role: string; name: string; email: string; active: boolean; email_reports: boolean; pin?: string }

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'config' | 'directors' | 'setup'>('config')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [directors, setDirectors] = useState<Director[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newDir, setNewDir] = useState({ pin: '', role: ROLES[0], name: '', email: '' })
  const [addingDir, setAddingDir] = useState(false)
  const [dirError, setDirError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', pin: '' })
  const [editError, setEditError] = useState('')
  const [showNewPin, setShowNewPin] = useState(false)
  const [showEditPin, setShowEditPin] = useState(false)
  const [initStatus, setInitStatus] = useState('')
  const [triageStatus, setTriageStatus] = useState('')
  const [runningTriage, setRunningTriage] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)
  const [seedStatus, setSeedStatus] = useState('')
  const [seedingData, setSeedingData] = useState(false)
  const [clearingData, setClearingData] = useState(false)
  const [moderationResults, setModerationResults] = useState<Array<{ description: string; expected: string; actual: string; passed: boolean }> | null>(null)
  const [directorName, setDirectorName] = useState('')
  const [directorRole, setDirectorRole] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/config').then((r) => { if (r.status === 403) { router.push('/'); return null } return r.json() }),
      fetch('/api/admin/directors').then((r) => r.json()),
    ]).then(([cfg, dirs]) => {
      if (cfg) {
        setConfig(cfg.config)
        setDirectorName(cfg.directorName ?? '')
        setDirectorRole(cfg.role ?? '')
      }
      if (dirs) setDirectors(dirs.directors)
    }).finally(() => setLoading(false))
  }, [router])

  function handleEdit(key: string, value: string) {
    setEdits((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function saveConfig() {
    setSaving(true)
    const updates = Object.entries(edits).map(([key, value]) => ({ key, value }))
    await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    setConfig((prev) => prev.map((r) => edits[r.key] !== undefined ? { ...r, value: edits[r.key] } : r))
    setEdits({})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function addDirector() {
    setDirError('')
    const missing = ['name', 'email', 'role', 'pin'].filter((f) => !newDir[f as keyof typeof newDir])
    if (missing.length > 0) {
      setDirError(`Missing: ${missing.join(', ')}`)
      return
    }
    setAddingDir(true)
    const res = await fetch('/api/admin/directors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDir),
    })
    if (res.ok) {
      const updated = await fetch('/api/admin/directors').then((r) => r.json())
      setDirectors(updated.directors)
      setNewDir({ pin: '', role: ROLES[0], name: '', email: '' })
    } else {
      const json = await res.json().catch(() => ({}))
      setDirError(json.error ?? 'Failed to add director')
    }
    setAddingDir(false)
  }

  async function toggleDirector(id: number, active: boolean) {
    await fetch('/api/admin/directors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
    setDirectors((prev) => prev.map((d) => d.id === id ? { ...d, active } : d))
  }

  async function toggleEmailReports(id: number, email_reports: boolean) {
    await fetch('/api/admin/directors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email_reports }),
    })
    setDirectors((prev) => prev.map((d) => d.id === id ? { ...d, email_reports } : d))
  }

  function startEdit(d: Director) {
    setEditingId(d.id)
    setEditForm({ name: d.name, email: d.email, role: d.role, pin: d.pin ?? '' })
    setEditError('')
  }

  async function saveEdit(id: number) {
    setEditError('')
    const res = await fetch('/api/admin/directors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    if (res.ok) {
      setDirectors((prev) => prev.map((d) => d.id === id ? { ...d, name: editForm.name, email: editForm.email, role: editForm.role, pin: editForm.pin || d.pin } : d))
      setEditingId(null)
    } else {
      const data = await res.json().catch(() => ({}))
      setEditError(data.error ?? 'Failed to save changes')
    }
  }

  async function deleteDirector(id: number) {
    if (!confirm('Remove this director?')) return
    await fetch('/api/admin/directors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDirectors((prev) => prev.filter((d) => d.id !== id))
  }

  async function initDb() {
    setInitStatus('Initialising…')
    const res = await fetch('/api/admin/init-db', { method: 'POST' })
    setInitStatus(res.ok ? '✓ Database initialised successfully' : '✗ Error — check logs')
  }

  async function exportCsv() {
    setExportingCsv(true)
    const res = await fetch('/api/admin/export-csv')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bramley-backup-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportingCsv(false)
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm(`Restore from ${file.name}? Existing records will be updated, new ones added. No data will be deleted.`)) {
      e.target.value = ''
      return
    }
    setImportingCsv(true)
    setImportStatus('Restoring…')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/import-csv', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    setImportStatus(res.ok ? `✓ ${json.upserted} records restored` : `✗ Error: ${json.error ?? 'check logs'}`)
    setImportingCsv(false)
    e.target.value = ''
  }

  async function seedTestData() {
    if (!confirm('Insert 12 test submissions into the database? Run triage afterwards to score them.')) return
    setSeedingData(true)
    setSeedStatus('Inserting test data…')
    const res = await fetch('/api/admin/seed-test-data', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setSeedStatus(res.ok ? `✓ ${json.inserted} submissions inserted — run triage to score them` : `✗ Error: ${json.error ?? 'check logs'}`)
    if (json.moderationResults) setModerationResults(json.moderationResults)
    setSeedingData(false)
  }

  async function clearTestData() {
    if (!confirm('Delete all test submissions? This cannot be undone.')) return
    setClearingData(true)
    setSeedStatus('Clearing test data…')
    const res = await fetch('/api/admin/clear-test-data', { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    setSeedStatus(res.ok ? `✓ ${json.deleted} test submissions removed` : `✗ Error: ${json.error ?? 'check logs'}`)
    setClearingData(false)
  }

  async function runTriage() {
    if (!confirm('Run the triage batch now? This will score all pending improvements and send email reports.')) return
    setRunningTriage(true)
    setTriageStatus('Running triage — this may take 30–60 seconds…')
    const res = await fetch('/api/admin/run-triage', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setTriageStatus(`✓ Triage complete — ${json.scored ?? 0} improvement${json.scored !== 1 ? 's' : ''} scored`)
    } else {
      setTriageStatus(`✗ Error: ${json.error ?? 'check server logs'}`)
    }
    setRunningTriage(false)
  }

  function configValue(key: string) {
    return edits[key] ?? config.find((r) => r.key === key)?.value ?? ''
  }

  if (loading) {
    return (
      <div className="bramley-card">
        <BramleyHeader subtitle="Admin" />
        <div className="bramley-body flex justify-center py-12">
          <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="bramley-wide-page space-y-4">
      <div className="bramley-card">
        <div className="bramley-header flex justify-between items-center">
          <BramleyHeader
            subtitle={`${directorName ? directorName + ' — ' : ''}${directorRole || 'Admin'} — Admin`}
            right={
              <div className="flex gap-3">
                <button onClick={() => router.push('/triage')} className="text-xs opacity-70 hover:opacity-100">← Triage</button>
                <button onClick={handleLogout} className="text-xs opacity-70 hover:opacity-100">Sign out</button>
              </div>
            }
          />
        </div>

        {/* Tabs */}
        <div className="bramley-body pb-0">
          <div className="flex gap-2">
            {(['config', 'directors', 'setup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-t-[8px] text-sm font-semibold transition-all capitalize ${tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                style={tab === t ? { background: 'var(--bramley-navy)' } : {}}
              >
                {t === 'config' ? 'Scoring Config' : t === 'directors' ? 'Directors' : 'Setup'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Config tab */}
      {tab === 'config' && (
        <div className="bramley-card">
          <div className="bramley-body space-y-6">
            {CONFIG_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="font-semibold text-gray-800 mb-1">{group.title}</h3>
                {group.note && <p className="text-xs text-gray-500 mb-2">{group.note}</p>}
                <div className="space-y-2">
                  {group.keys.map((key) => {
                    const row = config.find((r) => r.key === key)
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 flex-1">{row?.label ?? key}</label>
                        <input
                          type="number"
                          step="any"
                          className="bramley-input w-32 text-right py-1.5 text-sm"
                          value={configValue(key)}
                          onChange={(e) => handleEdit(key, e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveConfig} className="bramley-btn" disabled={saving || Object.keys(edits).length === 0}>
                {saving ? <span className="spinner" /> : 'Save changes'}
              </button>
              {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
            </div>
          </div>
        </div>
      )}

      {/* Directors tab */}
      {tab === 'directors' && (
        <div className="bramley-card">
          <div className="bramley-body space-y-4">
            {directors.map((d) => (
              <div key={d.id} className="border border-gray-200 rounded-[10px] overflow-hidden">
                {/* Summary row */}
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.role} · {d.email} · PIN: {d.pin ?? '—'}</p>
                  </div>
                  <button
                    onClick={() => toggleDirector(d.id, !d.active)}
                    className={`text-xs px-2 py-1 rounded-[6px] font-semibold ${d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {d.active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => toggleEmailReports(d.id, !d.email_reports)}
                    className={`text-xs px-2 py-1 rounded-[6px] font-semibold ${d.email_reports ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}
                    title="Toggle triage report emails"
                  >
                    {d.email_reports ? '✉ Emails on' : '✉ Emails off'}
                  </button>
                  <button
                    onClick={() => editingId === d.id ? setEditingId(null) : startEdit(d)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    {editingId === d.id ? 'Cancel' : 'Edit'}
                  </button>
                  <button onClick={() => deleteDirector(d.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>

                {/* Inline edit form */}
                {editingId === d.id && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                    <input className="bramley-input text-sm py-2" placeholder="Full name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <input className="bramley-input text-sm py-2" placeholder="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <select className="bramley-input text-sm py-2" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div className="relative">
                      <input className="bramley-input text-sm py-2 pr-12" placeholder="PIN" type={showEditPin ? 'text' : 'password'} value={editForm.pin} onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })} />
                      <button type="button" onClick={() => setShowEditPin(!showEditPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm hover:text-gray-600" tabIndex={-1}>{showEditPin ? 'Hide' : 'Show'}</button>
                    </div>
                    {editError && <p className="bramley-error">{editError}</p>}
                    <button onClick={() => saveEdit(d.id)} className="bramley-btn py-2 text-sm">Save changes</button>
                  </div>
                )}
              </div>
            ))}

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Add director / committee member</h3>
              <input className="bramley-input" placeholder="Full name" value={newDir.name} onChange={(e) => setNewDir({ ...newDir, name: e.target.value })} />
              <input className="bramley-input" placeholder="Email address" type="email" value={newDir.email} onChange={(e) => setNewDir({ ...newDir, email: e.target.value })} />
              <select className="bramley-input" value={newDir.role} onChange={(e) => setNewDir({ ...newDir, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="relative">
                <input className="bramley-input pr-12" placeholder="Set their PIN" type={showNewPin ? 'text' : 'password'} value={newDir.pin} onChange={(e) => setNewDir({ ...newDir, pin: e.target.value })} />
                <button type="button" onClick={() => setShowNewPin(!showNewPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm hover:text-gray-600" tabIndex={-1}>{showNewPin ? 'Hide' : 'Show'}</button>
              </div>
              {dirError && <p className="bramley-error">{dirError}</p>}
              <button onClick={addDirector} className="bramley-btn" disabled={addingDir}>
                {addingDir ? <span className="spinner" /> : 'Add director'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup tab */}
      {tab === 'setup' && (
        <div className="bramley-card">
          <div className="bramley-body space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Database initialisation</h3>
              <p className="text-sm text-gray-500 mb-3">Run once on first deployment to create all tables and seed default configuration values. Safe to run again — existing data is preserved.</p>
              <button onClick={initDb} className="bramley-btn">⚙ Initialise database</button>
              {initStatus && <p className="text-sm mt-2 text-gray-700">{initStatus}</p>}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Run triage now</h3>
              <p className="text-sm text-gray-500 mb-3">Manually trigger the AI scoring batch. Scores all pending improvements, updates clusters, flags H&amp;S items and sends the weekly email report. Normally runs automatically every Monday at 07:00.</p>
              <button
                onClick={runTriage}
                disabled={runningTriage}
                className="bramley-btn flex items-center justify-center gap-2"
              >
                {runningTriage ? <><span className="spinner" /> Running…</> : '▶ Run triage now'}
              </button>
              {triageStatus && <p className="text-sm mt-2 text-gray-700">{triageStatus}</p>}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Backup &amp; restore</h3>
              <p className="text-sm text-gray-500 mb-3">
                Export all submissions as a CSV file. A backup is also emailed automatically to the Operations Manager every Sunday at 06:00.
                To restore, upload a previously exported CSV — existing records are updated, missing records are re-inserted. No data is deleted.
              </p>
              <div className="flex gap-3 flex-wrap items-center">
                <button
                  onClick={exportCsv}
                  disabled={exportingCsv}
                  className="bramley-btn"
                  style={{ background: '#1e8449' }}
                >
                  {exportingCsv ? <><span className="spinner" /> Exporting…</> : '⬇ Export CSV'}
                </button>
                <label className={`bramley-btn text-center cursor-pointer ${importingCsv ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ background: '#2471a3' }}>
                  {importingCsv ? 'Restoring…' : '⬆ Restore from CSV'}
                  <input type="file" accept=".csv" className="hidden" onChange={importCsv} disabled={importingCsv} />
                </label>
              </div>
              {importStatus && <p className="text-sm mt-2 text-gray-700">{importStatus}</p>}
            </div>

            <hr className="border-gray-200" />

            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Test data</h3>
              <p className="text-sm text-gray-500 mb-3">
                Insert 12 pre-written test submissions covering all scenarios: high-priority, H&amp;S, quick wins,
                cluster pair, high-cost, low-priority, and more. Emails during triage will still go to DEBUG_EMAIL only.
                Use <strong>Clear test data</strong> to remove them cleanly when done.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={seedTestData}
                  disabled={seedingData || clearingData}
                  className="bramley-btn"
                  style={{ background: '#2471a3' }}
                >
                  {seedingData ? <><span className="spinner" /> Seeding…</> : '⬇ Seed test data'}
                </button>
                <button
                  onClick={clearTestData}
                  disabled={seedingData || clearingData}
                  className="bramley-btn"
                  style={{ background: '#c0392b' }}
                >
                  {clearingData ? <><span className="spinner" /> Clearing…</> : '✕ Clear test data'}
                </button>
              </div>
              {seedStatus && <p className="text-sm mt-2 text-gray-700">{seedStatus}</p>}
              {moderationResults && (
                <div className="mt-3 border border-gray-200 rounded-[8px] overflow-hidden">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 border-b border-gray-200">Moderation gate results</p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-1.5 text-gray-500 font-semibold">Submission</th>
                        <th className="text-left px-3 py-1.5 text-gray-500 font-semibold w-28">Expected</th>
                        <th className="text-left px-3 py-1.5 text-gray-500 font-semibold w-28">Actual</th>
                        <th className="w-16 px-3 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {moderationResults.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-1.5 text-gray-700 truncate max-w-0" style={{ maxWidth: '260px' }}>{r.description}…</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.expected}</td>
                          <td className="px-3 py-1.5 text-gray-700">{r.actual}</td>
                          <td className="px-3 py-1.5 text-center">
                            {r.passed
                              ? <span className="text-red-500 font-bold" title="AI missed this">✗ Slipped through</span>
                              : <span className="text-green-600 font-bold">✓ Caught</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
