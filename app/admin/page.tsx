'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = ['Club Manager', 'Chair', 'Golf Director', 'Estate Director', 'F&B Director', 'Commercial Director']

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
interface Director { id: number; role: string; name: string; email: string; active: boolean }

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'config' | 'directors' | 'setup'>('config')
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [directors, setDirectors] = useState<Director[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newDir, setNewDir] = useState({ pin: '', role: '', name: '', email: '' })
  const [addingDir, setAddingDir] = useState(false)
  const [dirError, setDirError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', pin: '' })
  const [editError, setEditError] = useState('')
  const [initStatus, setInitStatus] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/config').then((r) => { if (r.status === 403) { router.push('/'); return null } return r.json() }),
      fetch('/api/admin/directors').then((r) => r.json()),
    ]).then(([cfg, dirs]) => {
      if (cfg) setConfig(cfg.config)
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
    if (!newDir.pin || !newDir.role || !newDir.name || !newDir.email) {
      setDirError('All fields are required')
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
      setNewDir({ pin: '', role: '', name: '', email: '' })
    } else {
      setDirError('Failed to add director')
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

  function startEdit(d: Director) {
    setEditingId(d.id)
    setEditForm({ name: d.name, email: d.email, role: d.role, pin: '' })
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
      setDirectors((prev) => prev.map((d) => d.id === id ? { ...d, name: editForm.name, email: editForm.email, role: editForm.role } : d))
      setEditingId(null)
    } else {
      setEditError('Failed to save changes')
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
    const res = await fetch('/api/admin/init-db', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    })
    setInitStatus(res.ok ? '✓ Database initialised successfully' : '✗ Error — check logs')
  }

  function configValue(key: string) {
    return edits[key] ?? config.find((r) => r.key === key)?.value ?? ''
  }

  if (loading) {
    return (
      <div className="bramley-card">
        <div className="bramley-header">⛳ Admin</div>
        <div className="bramley-body flex justify-center py-12">
          <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="bramley-card">
        <div className="bramley-header flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">⛳ Bramley GC — Admin</h1>
            <p className="text-sm opacity-80 mt-0.5">Club Manager settings</p>
          </div>
          <button onClick={() => router.push('/triage')} className="text-xs opacity-70 hover:opacity-100">← Triage</button>
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
                          step="0.01"
                          className="bramley-input w-24 text-right py-1.5 text-sm"
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
                    <p className="text-xs text-gray-500">{d.role} · {d.email}</p>
                  </div>
                  <button
                    onClick={() => toggleDirector(d.id, !d.active)}
                    className={`text-xs px-2 py-1 rounded-[6px] font-semibold ${d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {d.active ? 'Active' : 'Inactive'}
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
                    <input className="bramley-input text-sm py-2" placeholder="New PIN (leave blank to keep existing)" type="password" value={editForm.pin} onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })} />
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
                <option value="">Select role…</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input className="bramley-input" placeholder="Set their PIN (they can change it by contacting you)" type="password" value={newDir.pin} onChange={(e) => setNewDir({ ...newDir, pin: e.target.value })} />
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
              <button onClick={initDb} className="bramley-btn">Initialise database</button>
              {initStatus && <p className="text-sm mt-2 text-gray-700">{initStatus}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
