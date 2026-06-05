'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, STATUS_LABELS } from '@/lib/categories'
import BramleyHeader from '@/components/BramleyHeader'

interface Submission {
  id: number
  description: string
  benefit: string
  category: string
  status: string
  score: number | null
  score_band: string | null
  h_and_s_flag: boolean
  ai_summary: string | null
  ai_narrative: string | null
  cost_band: string | null
  cost_estimate_low: number | null
  cost_estimate_high: number | null
  cost_confidence: string | null
  cost_rationale: string | null
  impl_weeks_low: number | null
  impl_weeks_high: number | null
  impl_complexity: string | null
  suggested_target_date: string | null
  cost_threshold_flag: boolean
  quick_win_flag: boolean
  strategic_note: string | null
  recognition: string
  member_name: string | null
  cluster_theme: string | null
  cluster_size: number | null
  created_at: string
  moderation_reason: string | null
  suggested_owner: string | null
  needs_external_approval: boolean
  approval_body: string | null
  recurring_flag: boolean
  recurring_run_count: number
  seasonal_window: string | null
  revenue_opportunity: boolean
  revenue_note: string | null
}

interface TrackedImprovement {
  id: number
  description: string
  ai_summary: string | null
  category: string
  status: string
  score: number | null
  cost_band: string | null
  cost_estimate_low: number | null
  cost_estimate_high: number | null
  impl_complexity: string | null
  impl_weeks_low: number | null
  impl_weeks_high: number | null
  suggested_target_date: string | null
  quick_win_flag: boolean
  cost_threshold_flag: boolean
  target_date: string | null
  responsible_person: string | null
  budget_year: number | null
  actual_cost: number | null
  tracking_notes: string | null
  member_name: string | null
  recognition: string
}

interface TriageData {
  role: string
  directorName: string
  submissions: Submission[]
  isManager: boolean
}

export default function TriagePage() {
  const router = useRouter()
  const [data, setData] = useState<TriageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [updating, setUpdating] = useState<number | null>(null)
  const [tab, setTab] = useState<'triage' | 'tracking' | 'moderated'>('triage')
  const [tracked, setTracked] = useState<TrackedImprovement[]>([])
  const [trackingEdit, setTrackingEdit] = useState<Record<number, Partial<TrackedImprovement>>>({})
  const [savingTracking, setSavingTracking] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/triage')
      .then((r) => {
        if (r.status === 403) { router.push('/'); return null }
        return r.json()
      })
      .then((d) => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [router])

  function refreshTracking() {
    fetch('/api/tracking').then((r) => r.json()).then((d) => setTracked(d.improvements ?? []))
  }

  useEffect(() => {
    if (tab === 'tracking') refreshTracking()
  }, [tab])

  async function saveTracking(id: number) {
    setSavingTracking(id)
    await fetch('/api/tracking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...trackingEdit[id] }),
    })
    setTracked((prev) => prev.map((t) => t.id === id ? { ...t, ...trackingEdit[id] } : t))
    setTrackingEdit((prev) => { const n = { ...prev }; delete n[id]; return n })
    setSavingTracking(null)
  }

  function editTracking(id: number, field: string, value: string | number | null) {
    setTrackingEdit((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const [deleting, setDeleting] = useState<number | null>(null)
  const [completing, setCompleting] = useState<number | null>(null)
  const [recognitionAlert, setRecognitionAlert] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterFlag, setFilterFlag] = useState<string>('all')
  const [filterOwner, setFilterOwner] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'status'>('score')
  const [viewMode, setViewMode] = useState<'card' | 'grid'>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem('triageViewMode') : null) as 'card' | 'grid' ?? 'card'
  )
  const [sidePanelId, setSidePanelId] = useState<number | null>(null)

  async function deleteImprovement(id: number) {
    if (!confirm('Remove this improvement? This cannot be undone.')) return
    setDeleting(id)
    await fetch('/api/triage', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setData((prev) => prev ? {
      ...prev,
      submissions: prev.submissions.filter((s) => s.id !== id),
    } : prev)
    setDeleting(null)
  }

  async function markComplete(id: number) {
    setCompleting(id)
    const res = await fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const d = await res.json()
    setTracked((prev) => prev.map((t) => t.id === id ? { ...t, status: 'implemented' } : t))
    if (d.recognitionRequired && d.memberName) {
      setRecognitionAlert(`${d.memberName} is eligible for recognition. Please follow up via the recognition workflow.`)
    }
    setCompleting(null)
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function updateField(id: number, field: 'status' | 'category' | 'suggested_owner', value: string) {
    setUpdating(id)
    await fetch('/api/triage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    })
    setData((prev) => prev ? {
      ...prev,
      submissions: prev.submissions.map((s) => s.id === id ? { ...s, [field]: value } : s),
    } : prev)
    setUpdating(null)
    if (field === 'status' && (value === 'approved' || value === 'implemented')) {
      refreshTracking()
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="bramley-card">
        <BramleyHeader subtitle="Triage Report" />
        <div className="bramley-body flex justify-center py-12">
          <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  if (!data) return null

  const STATUS_ORDER: Record<string, number> = {
    new: 0, under_consideration: 1, approved: 2, implemented: 3, rejected: 4,
  }

  function applySort<T extends { score?: number | null; created_at?: string; scored_at?: string | null; status?: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      if (sortBy === 'score') return (Number(b.score) || 0) - (Number(a.score) || 0)
      if (sortBy === 'status') return (STATUS_ORDER[a.status ?? ''] ?? 9) - (STATUS_ORDER[b.status ?? ''] ?? 9)
      return new Date(b.created_at ?? b.scored_at ?? 0).getTime() - new Date(a.created_at ?? a.scored_at ?? 0).getTime()
    })
  }

  const moderated = data.submissions.filter((s) => s.moderation_reason)
    .filter((s) => filterCategory === 'all' || s.category === filterCategory)
  const triageItems = data.submissions.filter((s) => !s.moderation_reason)

  function applyFilters(items: Submission[]) {
    return items.filter((s) => {
      if (filterCategory !== 'all' && s.category !== filterCategory) return false
      if (filterStatus !== 'all' && s.status !== filterStatus) return false
      if (filterFlag === 'quick_win' && !s.quick_win_flag) return false
      if (filterFlag === 'h_and_s' && !s.h_and_s_flag) return false
      if (filterFlag === 'revenue' && !s.revenue_opportunity) return false
      if (filterFlag === 'recurring' && !s.recurring_flag) return false
      if (filterFlag === 'in_plan' && s.status !== 'in_plan') return false
      if (filterFlag === 'cost_threshold' && !s.cost_threshold_flag) return false
      if (filterOwner !== 'all' && s.suggested_owner !== filterOwner) return false
      return true
    })
  }

  const ownerOptions = Array.from(
    new Set(
      data.submissions
        .filter((s) => !s.moderation_reason && s.suggested_owner)
        .map((s) => s.suggested_owner as string)
    )
  ).sort()

  const urgent = applySort(applyFilters(triageItems.filter((s) => s.h_and_s_flag)))
  const normal = applySort(applyFilters(triageItems.filter((s) => !s.h_and_s_flag)))

  const filteredTracked = applySort(
    filterCategory === 'all' ? tracked : tracked.filter((t) => t.category === filterCategory)
  )

  const tabCount = {
    triage: triageItems.filter(s => s.status === 'new' || s.status === 'under_consideration').length,
    tracking: 0,
    moderated: moderated.length,
  }

  return (
    <div className="bramley-wide-page space-y-4">
      {/* Header */}
      <div className="bramley-card">
        <div className="bramley-header flex justify-between items-center">
          <BramleyHeader
            subtitle={`${data.directorName} — ${data.role}`}
            right={
              <div className="flex gap-3 items-center">
                {data.isManager && (
                  <button onClick={() => router.push('/admin')} className="text-xs opacity-70 hover:opacity-100">Admin</button>
                )}
                <button onClick={handleLogout} className="text-xs opacity-70 hover:opacity-100">Sign out</button>
              </div>
            }
          />
        </div>
        <div className="bramley-body pb-0">
          <p className="text-sm text-gray-600 mb-3">
            {triageItems.filter(s => s.status === 'new' || s.status === 'under_consideration').length} pending · {triageItems.length} total in this view
            {urgent.length > 0 && <span className="ml-2 text-red-600 font-semibold">· {urgent.length} urgent H&amp;S</span>}
          </p>
          <div className="flex gap-2">
            {(['triage', 'tracking', 'moderated'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-t-[8px] text-sm font-semibold transition-all capitalize relative ${tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                style={tab === t ? { background: 'var(--bramley-navy)' } : {}}
              >
                {t === 'triage' ? 'Improvements' : t === 'tracking' ? 'Tracking' : 'Moderated'}
                {t === 'moderated' && tabCount.moderated > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{tabCount.moderated}</span>
                )}
                {t === 'triage' && tabCount.triage > 0 && (
                  <span className="ml-1.5 text-white text-xs rounded-full px-1.5 py-0.5" style={{ background: '#2471a3' }}>{tabCount.triage}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter & sort bar */}
      <div className="bramley-card">
        <div className="bramley-body py-3 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 shrink-0">Area</label>
            <select className="bramley-input text-sm py-1.5 flex-1" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All areas</option>
              {CATEGORIES.filter((c) => c.value !== 'other').map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 shrink-0">Decision</label>
            <select className="bramley-input text-sm py-1.5 flex-1" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All decisions</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 shrink-0">Flag</label>
            <select className="bramley-input text-sm py-1.5 flex-1" value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)}>
              <option value="all">All flags</option>
              <option value="quick_win">⚡ Quick wins</option>
              <option value="h_and_s">⚠️ Health &amp; Safety</option>
              <option value="revenue">💰 Revenue opportunity</option>
              <option value="recurring">🔁 Recurring theme</option>
              <option value="in_plan">📋 In plan</option>
              <option value="cost_threshold">£ Committee approval</option>
            </select>
          </div>
          {ownerOptions.length > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <label className="text-xs text-gray-500 shrink-0">Owner</label>
              <select className="bramley-input text-sm py-1.5 flex-1" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                <option value="all">All owners</option>
                {ownerOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Sort</label>
            <div className="flex rounded-[8px] overflow-hidden border border-gray-200">
              {(['score', 'status', 'date'] as const).map((s, i) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 text-sm transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${sortBy === s ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  style={sortBy === s ? { background: 'var(--bramley-navy)' } : {}}
                >
                  {s === 'score' ? 'Score' : s === 'status' ? 'Decision' : 'Date'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">View</label>
            <div className="flex rounded-[8px] overflow-hidden border border-gray-200">
              <button
                onClick={() => { setViewMode('card'); localStorage.setItem('triageViewMode', 'card') }}
                title="Expanded card view"
                className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'card' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                style={viewMode === 'card' ? { background: 'var(--bramley-navy)' } : {}}
              >☰</button>
              <button
                onClick={() => { setViewMode('grid'); setSidePanelId(null); localStorage.setItem('triageViewMode', 'grid') }}
                title="Spreadsheet view"
                className={`px-3 py-1.5 text-sm transition-colors border-l border-gray-200 ${viewMode === 'grid' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                style={viewMode === 'grid' ? { background: 'var(--bramley-navy)' } : {}}
              >⊞</button>
            </div>
          </div>
        </div>
      </div>

      {/* Recognition alert */}
      {recognitionAlert && (
        <div className="bramley-card border-2 border-amber-400 bg-amber-50">
          <div className="bramley-body flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">🏆 Recognition required</p>
              <p className="text-sm text-amber-700 mt-1">{recognitionAlert}</p>
            </div>
            <button onClick={() => setRecognitionAlert(null)} className="text-amber-500 hover:text-amber-700 text-lg leading-none shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* ── Triage tab ─────────────────────────────────────────────── */}
      {tab === 'triage' && viewMode === 'card' && (
        <div className="bramley-card overflow-hidden">
          {urgent.length > 0 && (
            <div className="border-b-2 border-red-200">
              <div className="px-4 py-2 bg-red-50 flex items-center gap-2">
                <span className="text-sm font-bold text-red-600">⚠️ Urgent — Health &amp; Safety</span>
                <span className="bramley-badge bg-red-600 text-xs">{urgent.length}</span>
              </div>
              <TriageTable
                subs={urgent}
                urgent
                expanded={expanded}
                onToggle={toggleExpand}
                isManager={data.isManager}
                onUpdate={updateField}
                onDelete={deleteImprovement}
                updating={updating}
                deleting={deleting}
                formatDate={formatDate}
              />
            </div>
          )}
          {normal.length > 0 ? (
            <>
              {urgent.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-600">Improvements ({normal.length})</span>
                </div>
              )}
              <TriageTable
                subs={normal}
                expanded={expanded}
                onToggle={toggleExpand}
                isManager={data.isManager}
                onUpdate={updateField}
                onDelete={deleteImprovement}
                updating={updating}
                deleting={deleting}
                formatDate={formatDate}
              />
            </>
          ) : urgent.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">
              {filterCategory !== 'all' ? 'No improvements in this area.' : 'No improvements to triage.'}
            </p>
          ) : null}
        </div>
      )}

      {/* ── Spreadsheet view ───────────────────────────────────────── */}
      {tab === 'triage' && viewMode === 'grid' && (
        <div className="flex gap-4 items-start">
          <div className="bramley-card overflow-hidden flex-1 min-w-0">
            <SpreadsheetTable
              subs={[...urgent, ...normal]}
              isManager={data.isManager}
              onUpdate={updateField}
              selectedId={sidePanelId}
              onSelect={setSidePanelId}
              formatDate={formatDate}
            />
            {urgent.length === 0 && normal.length === 0 && (
              <p className="text-center text-gray-500 py-12 text-sm">No improvements to triage.</p>
            )}
          </div>
          {sidePanelId != null && (() => {
            const s = [...urgent, ...normal].find(x => x.id === sidePanelId)
            if (!s) return null
            return (
              <SpreadsheetDetailPanel
                s={s}
                isManager={data.isManager}
                onUpdate={updateField}
                onDelete={deleteImprovement}
                onClose={() => setSidePanelId(null)}
                updating={updating === s.id}
                deleting={deleting === s.id}
              />
            )
          })()}
        </div>
      )}

      {/* ── Tracking tab ───────────────────────────────────────────── */}
      {tab === 'tracking' && (
        <div className="bramley-card">
          <div className="bramley-body">
            {filteredTracked.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{filterCategory === 'all' ? 'No approved or implemented improvements yet.' : 'No items in this area.'}</p>
            ) : (
              <div className="space-y-4">
                {filteredTracked.map((t) => (
                  <div key={t.id} className="border border-gray-200 rounded-[10px] overflow-hidden">
                    <div className="p-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{t.ai_summary ?? t.description}</p>
                        <span className={`bramley-badge shrink-0 ${t.status === 'implemented' ? 'status-implemented' : 'status-approved'}`}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{CATEGORIES.find(c => c.value === t.category)?.label} {t.score != null ? `· Score ${Number(t.score).toFixed(1)}` : ''}</p>
                      {t.recognition !== 'anonymous' && t.member_name && (
                        <p className="text-xs text-gray-400">Submitted by {t.member_name}</p>
                      )}
                    </div>

                    {data.isManager && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Target date
                            {t.suggested_target_date && !t.target_date && (
                              <button
                                onClick={() => editTracking(t.id, 'target_date', t.suggested_target_date)}
                                className="ml-2 text-blue-500 hover:text-blue-700 underline normal-case font-normal"
                              >
                                Use AI suggestion ({new Date(t.suggested_target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})
                              </button>
                            )}
                          </label>
                          <input
                            type="date"
                            className="bramley-input text-sm py-1.5"
                            value={trackingEdit[t.id]?.target_date ?? t.target_date ?? ''}
                            onChange={(e) => editTracking(t.id, 'target_date', e.target.value || null)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Responsible person</label>
                          <input
                            type="text"
                            className="bramley-input text-sm py-1.5"
                            placeholder="Name or role"
                            value={trackingEdit[t.id]?.responsible_person ?? t.responsible_person ?? ''}
                            onChange={(e) => editTracking(t.id, 'responsible_person', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Budget year</label>
                          <input
                            type="number"
                            className="bramley-input text-sm py-1.5"
                            placeholder={new Date().getFullYear().toString()}
                            value={trackingEdit[t.id]?.budget_year ?? t.budget_year ?? ''}
                            onChange={(e) => editTracking(t.id, 'budget_year', parseInt(e.target.value) || null)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Actual cost (£)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="bramley-input text-sm py-1.5"
                            placeholder="0.00"
                            value={trackingEdit[t.id]?.actual_cost ?? t.actual_cost ?? ''}
                            onChange={(e) => editTracking(t.id, 'actual_cost', parseFloat(e.target.value) || null)}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500 block mb-1">Notes</label>
                          <textarea
                            className="bramley-input resize-none text-sm"
                            rows={2}
                            placeholder="Progress notes, blockers, decisions…"
                            value={trackingEdit[t.id]?.tracking_notes ?? t.tracking_notes ?? ''}
                            onChange={(e) => editTracking(t.id, 'tracking_notes', e.target.value)}
                          />
                        </div>
                        {trackingEdit[t.id] && (
                          <div className="col-span-2">
                            <button onClick={() => saveTracking(t.id)} className="bramley-btn py-2 text-sm" disabled={savingTracking === t.id}>
                              {savingTracking === t.id ? <span className="spinner" /> : 'Save'}
                            </button>
                          </div>
                        )}
                        {t.status === 'approved' && (
                          <div className="col-span-2 pt-1 border-t border-gray-200">
                            <button
                              onClick={() => markComplete(t.id)}
                              disabled={completing === t.id}
                              className="bramley-btn py-2 text-sm"
                              style={{ background: '#1e8449' }}
                            >
                              {completing === t.id ? <span className="spinner" /> : '✓ Mark as implemented'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Moderated tab ──────────────────────────────────────────── */}
      {tab === 'moderated' && data.isManager && (
        <div className="bramley-card">
          <div className="bramley-body">
            {moderated.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No moderated submissions.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">These submissions were silently rejected by the AI moderation gate. Members received a neutral response.</p>
                {moderated.map((s) => (
                  <div key={s.id} className="border border-amber-200 bg-amber-50 rounded-[10px] p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        {s.moderation_reason?.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-800">{s.description}</p>
                    {s.benefit && <p className="text-xs text-gray-600 italic">"{s.benefit}"</p>}
                    <p className="text-xs text-gray-400">{CATEGORIES.find(c => c.value === s.category)?.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Spreadsheet table ───────────────────────────────────────────────────────

function SpreadsheetTable({
  subs, isManager, onUpdate, selectedId, onSelect, formatDate,
}: {
  subs: Submission[]
  isManager: boolean
  onUpdate: (id: number, field: 'status' | 'category' | 'suggested_owner', value: string) => void
  selectedId: number | null
  onSelect: (id: number | null) => void
  formatDate: (iso: string) => string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50">
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-12">Score</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide">Improvement</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-28 hidden md:table-cell">Area</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-36 hidden lg:table-cell">Owner</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-44 hidden lg:table-cell">Cost</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-24 hidden lg:table-cell">Impl</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-24 hidden md:table-cell">Date</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-36">Decision</th>
            <th className="w-16 py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide text-center hidden sm:table-cell">Flags</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const isSelected = selectedId === s.id
            const isUrgent = s.h_and_s_flag
            return (
              <tr
                key={s.id}
                onClick={() => onSelect(isSelected ? null : s.id)}
                className={`border-b border-gray-100 cursor-pointer transition-colors
                  ${isUrgent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-50'}
                  ${isSelected ? (isUrgent ? 'bg-red-100 ring-1 ring-inset ring-red-400' : 'bg-blue-50 ring-1 ring-inset ring-blue-400') : ''}`}
              >
                {/* Score */}
                <td className="py-1.5 px-2 whitespace-nowrap">
                  {s.score != null ? (
                    <span className="bramley-badge text-xs" style={{ background: scoreBandColor(s.score_band) }}>
                      {Number(s.score).toFixed(1)}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>

                {/* Summary */}
                <td className="py-1.5 px-2 max-w-0">
                  <p className="truncate font-medium text-gray-800">{s.ai_summary ?? s.description}</p>
                </td>

                {/* Area */}
                <td className="py-1.5 px-2 text-gray-500 hidden md:table-cell whitespace-nowrap">
                  {CATEGORIES.find(c => c.value === s.category)?.label ?? s.category}
                </td>

                {/* Owner */}
                <td className="py-1.5 px-2 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                  {isManager ? (
                    <select
                      className="bramley-input text-xs py-0.5 px-1.5 w-full"
                      value={s.suggested_owner ?? ''}
                      onChange={(e) => onUpdate(s.id, 'suggested_owner', e.target.value)}
                    >
                      <option value="">— Unassigned —</option>
                      {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <span className="text-gray-600">{s.suggested_owner ?? <span className="text-gray-300">—</span>}</span>
                  )}
                </td>

                {/* Cost */}
                <td className="py-1.5 px-2 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                  {s.cost_estimate_low != null && s.cost_estimate_high != null
                    ? `£${Number(s.cost_estimate_low).toLocaleString()} – £${Number(s.cost_estimate_high).toLocaleString()}`
                    : s.cost_band
                      ? <span className="capitalize">{s.cost_band.replace('_', ' ')}</span>
                      : <span className="text-gray-300">—</span>}
                </td>

                {/* Impl */}
                <td className="py-1.5 px-2 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                  {s.impl_complexity
                    ? <span className={`capitalize ${s.quick_win_flag ? 'text-green-700 font-semibold' : ''}`}>{s.impl_complexity.replace('_', ' ')}</span>
                    : <span className="text-gray-300">—</span>}
                </td>

                {/* Date */}
                <td className="py-1.5 px-2 text-gray-400 hidden md:table-cell whitespace-nowrap">{formatDate(s.created_at)}</td>

                {/* Decision */}
                <td className="py-1.5 px-2" onClick={(e) => e.stopPropagation()}>
                  {isManager ? (
                    <select
                      className="bramley-input text-xs py-0.5 px-1.5 w-full"
                      value={s.status}
                      onChange={(e) => onUpdate(s.id, 'status', e.target.value)}
                    >
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`bramley-badge text-xs ${statusClass(s.status)}`}>{STATUS_LABELS[s.status] ?? s.status}</span>
                  )}
                </td>

                {/* Flags */}
                <td className="py-1.5 px-2 text-center hidden sm:table-cell">
                  <div className="flex gap-0.5 justify-center flex-wrap">
                    {s.h_and_s_flag && <span title="H&S" className="text-red-600">⚠</span>}
                    {s.quick_win_flag && <span title="Quick win">⚡</span>}
                    {s.revenue_opportunity && <span title="Revenue">💰</span>}
                    {s.cost_threshold_flag && <span title="Committee approval" className="text-orange-600 font-bold text-xs">£</span>}
                    {s.needs_external_approval && <span title="External approval">⚖</span>}
                    {s.seasonal_window && <span title="Seasonal">📅</span>}
                    {s.recurring_flag && <span title={`Recurring ×${s.recurring_run_count + 1}`}>🔁</span>}
                    {s.cluster_theme && <span title={`Cluster: ${s.cluster_theme}`} className="text-blue-600 font-bold text-xs">C</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SpreadsheetDetailPanel({
  s, isManager, onUpdate, onDelete, onClose, updating, deleting,
}: {
  s: Submission
  isManager: boolean
  onUpdate: (id: number, field: 'status' | 'category' | 'suggested_owner', value: string) => void
  onDelete: (id: number) => void
  onClose: () => void
  updating: boolean
  deleting: boolean
}) {
  return (
    <div className="bramley-card w-80 xl:w-96 2xl:w-[440px] shrink-0 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="bramley-body space-y-4 text-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {s.score != null && (
              <span className="bramley-badge" style={{ background: scoreBandColor(s.score_band) }}>
                {Number(s.score).toFixed(1)}
              </span>
            )}
            <span className="text-xs text-gray-500">{CATEGORIES.find(c => c.value === s.category)?.label}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">✕</button>
        </div>

        {/* Improvement text */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Improvement</p>
          <p className="text-gray-800">{s.description}</p>
        </div>
        {s.benefit && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Perceived benefit</p>
            <p className="text-gray-700 text-xs">{s.benefit}</p>
          </div>
        )}

        {/* Flags */}
        <div className="flex gap-1 flex-wrap">
          {s.h_and_s_flag && <span className="bramley-badge text-xs bg-red-600">⚠ H&amp;S</span>}
          {s.score_band === 'in_plan' && <span className="bramley-badge text-xs" style={{ background: '#2471a3' }}>📋 In plan</span>}
          {s.quick_win_flag && <span className="bramley-badge text-xs" style={{ background: '#1e8449' }}>⚡ Quick win</span>}
          {s.revenue_opportunity && <span className="bramley-badge text-xs" style={{ background: '#6c3483' }}>💰 Revenue</span>}
          {s.cost_threshold_flag && <span className="bramley-badge text-xs" style={{ background: '#d35400' }}>£ Committee</span>}
          {s.needs_external_approval && <span className="bramley-badge text-xs" style={{ background: '#7d6608' }}>⚖ Approval</span>}
          {s.suggested_owner && <span className="bramley-badge text-xs" style={{ background: '#117a65' }}>👤 {s.suggested_owner}</span>}
          {s.seasonal_window && <span className="bramley-badge text-xs" style={{ background: '#1a5276' }}>📅 Seasonal</span>}
          {s.recurring_flag && <span className="bramley-badge text-xs" style={{ background: '#922b21' }}>🔁 Recurring ×{s.recurring_run_count + 1}</span>}
          {s.cluster_theme && <span className="bramley-badge text-xs" style={{ background: '#2471a3' }}>Cluster ({s.cluster_size})</span>}
        </div>

        {/* AI Assessment */}
        {(s.ai_narrative || s.cost_band || s.impl_complexity || s.strategic_note) && (
          <div className="rounded-[8px] border border-indigo-100 bg-indigo-50 p-3 space-y-2 text-xs">
            <p className="font-bold text-indigo-700 uppercase tracking-wider">🤖 AI Assessment</p>
            {s.ai_narrative && <p className="text-gray-700">{s.ai_narrative}</p>}
            {s.cost_estimate_low != null && s.cost_estimate_high != null && (
              <p><span className="font-semibold text-gray-500">Cost:</span> £{Number(s.cost_estimate_low).toLocaleString()} – £{Number(s.cost_estimate_high).toLocaleString()}
                {s.cost_confidence && <span className="text-gray-400"> ({s.cost_confidence})</span>}
              </p>
            )}
            {s.impl_complexity && (
              <p><span className="font-semibold text-gray-500">Implementation:</span> <span className="capitalize">{s.impl_complexity.replace('_', ' ')}</span>
                {s.impl_weeks_low != null && s.impl_weeks_high != null && ` · ${s.impl_weeks_low}–${s.impl_weeks_high}w`}
              </p>
            )}
            {s.suggested_target_date && (
              <p><span className="font-semibold text-gray-500">Target:</span> {new Date(s.suggested_target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            )}
            {s.strategic_note && <p className="text-gray-600 italic">{s.strategic_note}</p>}
            {s.cluster_theme && <p><span className="font-semibold text-blue-600">Cluster:</span> {s.cluster_theme} ({s.cluster_size})</p>}
            {s.seasonal_window && <p><span className="font-semibold text-gray-500">Seasonal:</span> {s.seasonal_window}</p>}
            {s.revenue_note && <p><span className="font-semibold text-purple-600">Revenue:</span> {s.revenue_note}</p>}
            {s.approval_body && <p><span className="font-semibold text-gray-500">Approval:</span> {s.approval_body}</p>}
          </div>
        )}

        {/* Committee Decision */}
        {isManager && (
          <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 space-y-2 text-xs">
            <p className="font-bold text-amber-700 uppercase tracking-wider">📋 Committee Decision</p>
            <div>
              <label className="text-gray-500 block mb-1">Status</label>
              <select
                className="bramley-input text-xs py-1 w-full"
                value={s.status}
                onChange={(e) => onUpdate(s.id, 'status', e.target.value)}
                disabled={updating}
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Owner</label>
              <select
                className="bramley-input text-xs py-1 w-full"
                value={s.suggested_owner ?? ''}
                onChange={(e) => onUpdate(s.id, 'suggested_owner', e.target.value)}
                disabled={updating}
              >
                <option value="">— Unassigned —</option>
                {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Area</label>
              <select
                className="bramley-input text-xs py-1 w-full"
                value={s.category}
                onChange={(e) => onUpdate(s.id, 'category', e.target.value)}
                disabled={updating}
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => onDelete(s.id)}
              disabled={deleting}
              className="text-red-500 hover:text-red-700 text-xs font-semibold"
            >
              {deleting ? 'Removing…' : '✕ Remove improvement'}
            </button>
          </div>
        )}

        {s.recognition !== 'anonymous' && s.member_name && (
          <p className="text-xs text-gray-400">Submitted by {s.member_name}</p>
        )}
      </div>
    </div>
  )
}

// ── Triage table ────────────────────────────────────────────────────────────

function TriageTable({
  subs, urgent, expanded, onToggle, isManager, onUpdate, onDelete, updating, deleting, formatDate,
}: {
  subs: Submission[]
  urgent?: boolean
  expanded: Set<number>
  onToggle: (id: number) => void
  isManager: boolean
  onUpdate: (id: number, field: 'status' | 'category' | 'suggested_owner', value: string) => void
  onDelete: (id: number) => void
  updating: number | null
  deleting: number | null
  formatDate: (iso: string) => string
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">Score</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Improvement</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28 hidden lg:table-cell">Area</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24 hidden md:table-cell">Date</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Decision</th>
          <th className="w-8"></th>
        </tr>
      </thead>
      <tbody>
        {subs.map((s) => (
          <SubmissionTableRow
            key={s.id}
            s={s}
            urgent={urgent}
            expanded={expanded.has(s.id)}
            onToggle={onToggle}
            isManager={isManager}
            onUpdate={onUpdate}
            onDelete={onDelete}
            updating={updating === s.id}
            deleting={deleting === s.id}
            formatDate={formatDate}
          />
        ))}
      </tbody>
    </table>
  )
}

function SubmissionTableRow({
  s, urgent, expanded, onToggle, isManager, onUpdate, onDelete, updating, deleting, formatDate,
}: {
  s: Submission
  urgent?: boolean
  expanded: boolean
  onToggle: (id: number) => void
  isManager: boolean
  onUpdate: (id: number, field: 'status' | 'category' | 'suggested_owner', value: string) => void
  onDelete: (id: number) => void
  updating: boolean
  deleting: boolean
  formatDate: (iso: string) => string
}) {
  const categoryLabel = CATEGORIES.find(c => c.value === s.category)?.label ?? s.category

  return (
    <>
      <tr
        className={`border-b border-gray-100 cursor-pointer transition-colors
          ${urgent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
          ${expanded ? (urgent ? 'bg-red-100' : 'bg-gray-50') : ''}`}
        onClick={() => onToggle(s.id)}
      >
        {/* Score */}
        <td className="py-2.5 px-3 align-top">
          {s.score != null ? (
            <span className="bramley-badge text-xs" style={{ background: scoreBandColor(s.score_band) }}>
              {Number(s.score).toFixed(1)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </td>

        {/* Summary + flags */}
        <td className="py-2.5 px-3 max-w-0 align-top">
          <p className="font-medium text-gray-800 truncate">{s.ai_summary ?? s.description}</p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {s.h_and_s_flag && <span className="bramley-badge text-xs bg-red-600">⚠ H&amp;S</span>}
            {s.score_band === 'in_plan' && <span className="bramley-badge text-xs" style={{ background: '#2471a3' }}>📋 In plan</span>}
            {s.quick_win_flag && <span className="bramley-badge text-xs" style={{ background: '#1e8449' }}>⚡ Quick win</span>}
            {s.revenue_opportunity && <span className="bramley-badge text-xs" style={{ background: '#6c3483' }}>💰 Revenue</span>}
            {s.cost_threshold_flag && <span className="bramley-badge text-xs" style={{ background: '#d35400' }}>£ Committee</span>}
            {s.needs_external_approval && <span className="bramley-badge text-xs" style={{ background: '#7d6608' }}>⚖ Approval</span>}
            {s.suggested_owner && <span className="bramley-badge text-xs" style={{ background: '#117a65' }}>👤 {s.suggested_owner}</span>}
            {s.seasonal_window && <span className="bramley-badge text-xs" style={{ background: '#1a5276' }}>📅 Seasonal</span>}
            {s.recurring_flag && <span className="bramley-badge text-xs" style={{ background: '#922b21' }}>🔁 Recurring ×{s.recurring_run_count + 1}</span>}
            {s.cluster_theme && <span className="bramley-badge text-xs" style={{ background: '#2471a3' }}>Cluster ({s.cluster_size})</span>}
          </div>
        </td>

        {/* Area */}
        <td className="py-2.5 px-3 text-xs text-gray-500 hidden lg:table-cell align-top whitespace-nowrap">{categoryLabel}</td>

        {/* Date */}
        <td className="py-2.5 px-3 text-xs text-gray-400 hidden md:table-cell align-top whitespace-nowrap">{formatDate(s.created_at)}</td>

        {/* Status — stop click propagation so the dropdown doesn't toggle expand */}
        <td className="py-2.5 px-3 align-top" onClick={(e) => e.stopPropagation()}>
          {isManager ? (
            <select
              className="bramley-input text-xs py-1 px-2"
              value={s.status}
              onChange={(e) => onUpdate(s.id, 'status', e.target.value)}
              disabled={updating}
            >
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          ) : (
            <span className={`bramley-badge text-xs ${statusClass(s.status)}`}>{STATUS_LABELS[s.status] ?? s.status}</span>
          )}
        </td>

        {/* Expand toggle */}
        <td className="py-2.5 px-3 text-center text-gray-400 text-xs align-top">{expanded ? '▲' : '▼'}</td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={urgent ? 'bg-red-50' : 'bg-gray-50'}>
          <td colSpan={6} className="px-5 py-4 border-b border-gray-200">
            <div className="max-w-4xl space-y-4">

              {/* ── Submission text ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Improvement</p>
                  <p className="text-sm text-gray-800">{s.description}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Perceived benefit</p>
                  <p className="text-sm text-gray-700">{s.benefit}</p>
                </div>
              </div>

              {/* ── AI Assessment section ── */}
              <div className="rounded-[10px] border border-indigo-100 bg-indigo-50 p-4 space-y-3">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">🤖 AI Assessment</p>

                {s.ai_narrative && (
                  <p className="text-sm text-gray-700">{s.ai_narrative}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {(s.cost_estimate_low != null || s.cost_band) && (
                    <div className={`rounded-[8px] px-3 py-2 col-span-2 ${s.cost_threshold_flag ? 'bg-orange-50 border border-orange-200' : 'bg-white border border-gray-200'}`}>
                      <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                        Cost estimate {s.cost_confidence && <span className="normal-case font-normal text-gray-400">({s.cost_confidence} confidence)</span>}
                      </span>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {s.cost_estimate_low != null && s.cost_estimate_high != null ? (
                          <span className="text-gray-900 font-semibold text-sm">
                            £{Number(s.cost_estimate_low).toLocaleString()} – £{Number(s.cost_estimate_high).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-800 capitalize">{s.cost_band?.replace('_', ' ')}</span>
                        )}
                        {s.cost_threshold_flag && <span className="text-orange-600 font-semibold">⚠ Exceeds committee threshold</span>}
                      </div>
                      {s.cost_rationale && <p className="text-gray-500 mt-0.5">{s.cost_rationale}</p>}
                    </div>
                  )}

                  {s.impl_complexity && (
                    <div className={`rounded-[8px] px-3 py-2 ${s.quick_win_flag ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'}`}>
                      <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-1">Implementation</span>
                      <span className={`font-semibold capitalize ${s.quick_win_flag ? 'text-green-700' : 'text-gray-800'}`}>
                        {s.impl_complexity.replace('_', ' ')}
                      </span>
                      {s.impl_weeks_low != null && s.impl_weeks_high != null && (
                        <p className="text-gray-500 mt-0.5">
                          {s.impl_weeks_low === s.impl_weeks_high ? `~${s.impl_weeks_low}w` : `${s.impl_weeks_low}–${s.impl_weeks_high}w`}
                        </p>
                      )}
                      {s.suggested_target_date && (
                        <p className="text-gray-400 mt-0.5">By {new Date(s.suggested_target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>
                  )}

                  {s.suggested_owner && (
                    <div className="bg-white border border-gray-200 rounded-[8px] px-3 py-2">
                      <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Suggested owner</span>
                      <span className="text-gray-800 font-medium">{s.suggested_owner}</span>
                    </div>
                  )}

                  {s.strategic_note && (
                    <div className="bg-white border border-gray-200 rounded-[8px] px-3 py-2 col-span-2">
                      <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Strategic alignment</span>
                      <span className="text-gray-800">{s.strategic_note}</span>
                    </div>
                  )}

                  {s.cluster_theme && (
                    <div className="bg-blue-50 border border-blue-200 rounded-[8px] px-3 py-2 col-span-2">
                      <span className="font-semibold text-blue-600 uppercase tracking-wide block mb-0.5">Cluster theme</span>
                      <span className="text-blue-800">{s.cluster_theme} ({s.cluster_size} submission{s.cluster_size !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  {s.recurring_flag && (
                    <div className="rounded-[8px] px-3 py-2 col-span-2" style={{ background: '#fdf2f8', border: '1px solid #e8b4d0' }}>
                      <span className="font-semibold uppercase tracking-wide block mb-0.5" style={{ color: '#922b21' }}>🔁 Recurring theme</span>
                      <span className="text-gray-700">This theme has appeared in {s.recurring_run_count} previous triage run{s.recurring_run_count !== 1 ? 's' : ''}. Persistent member pressure.</span>
                    </div>
                  )}

                  {s.needs_external_approval && s.approval_body && (
                    <div className="rounded-[8px] px-3 py-2 col-span-2" style={{ background: '#fef9e7', border: '1px solid #d4ac0d' }}>
                      <span className="font-semibold uppercase tracking-wide block mb-0.5" style={{ color: '#7d6608' }}>⚖ External approval required</span>
                      <span className="text-gray-700">{s.approval_body}</span>
                    </div>
                  )}

                  {s.seasonal_window && (
                    <div className="bg-blue-50 border border-blue-200 rounded-[8px] px-3 py-2 col-span-2">
                      <span className="font-semibold text-blue-700 uppercase tracking-wide block mb-0.5">📅 Seasonal window</span>
                      <span className="text-blue-800">{s.seasonal_window}</span>
                    </div>
                  )}

                  {s.revenue_opportunity && s.revenue_note && (
                    <div className="rounded-[8px] px-3 py-2 col-span-2" style={{ background: '#f5eef8', border: '1px solid #c39bd3' }}>
                      <span className="font-semibold uppercase tracking-wide block mb-0.5" style={{ color: '#6c3483' }}>💰 Revenue opportunity</span>
                      <span className="text-gray-700">{s.revenue_note}</span>
                    </div>
                  )}
                </div>

                {s.recognition !== 'anonymous' && s.member_name && (
                  <p className="text-xs text-indigo-400">Submitted by <span className="font-medium">{s.member_name}</span></p>
                )}
              </div>

              {/* ── Committee Decision section ── */}
              {isManager && (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">📋 Committee Decision</p>
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="min-w-[160px]">
                      <label className="text-xs text-gray-600 block mb-1">Assign owner</label>
                      <select
                        className="bramley-input text-sm py-1.5"
                        value={s.suggested_owner ?? ''}
                        onChange={(e) => onUpdate(s.id, 'suggested_owner', e.target.value)}
                        disabled={updating}
                      >
                        <option value="">— Unassigned —</option>
                        {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[160px]">
                      <label className="text-xs text-gray-600 block mb-1">Reassign area</label>
                      <select
                        className="bramley-input text-sm py-1.5"
                        value={s.category}
                        onChange={(e) => onUpdate(s.id, 'category', e.target.value)}
                        disabled={updating}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {s.status !== 'approved' && s.status !== 'implemented' && (
                      <button
                        onClick={() => onDelete(s.id)}
                        disabled={deleting}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors pb-1.5"
                      >
                        {deleting ? 'Removing…' : 'Remove improvement'}
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const OWNER_OPTIONS = [
  'Golf Director',
  'Estate Director',
  'F&B Director',
  'Commercial Director',
  'Club Manager',
  'Chairman',
]

function scoreBandColor(band: string | null): string {
  const map: Record<string, string> = {
    priority:      '#0d5d3d',
    active:        '#1e8449',
    holding:       '#b7770d',
    low_priority:  '#888',
    not_progressed:'#aaa',
    in_plan:       '#2471a3',
  }
  return map[band ?? ''] ?? '#888'
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    new:               'status-new',
    under_consideration:'status-under_consideration',
    approved:          'status-approved',
    implemented:       'status-implemented',
    rejected:          'status-rejected',
  }
  return map[status] ?? 'status-new'
}
