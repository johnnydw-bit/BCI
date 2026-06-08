'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, STATUS_LABELS, roleToAuthority, AUTHORITY_LEVELS } from '@/lib/categories'
import BramleyHeader from '@/components/BramleyHeader'
import FullscreenButton from '@/components/FullscreenButton'
import InstallPrompt from '@/components/InstallPrompt'

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
  from_board: boolean
  notes: string | null
  score_override: number | null
  score_override_reason: string | null
  score_override_by: string | null
  confirmed_target_date: string | null
  confirmed_cost: number | null
  decision_authority: string | null
  decision_by: string | null
}

interface AuditEntry {
  old_status: string | null
  new_status: string
  changed_by: string
  note: string | null
  changed_at: string
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
  const [updating, setUpdating] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [tab, setTab] = useState<'triage' | 'tracking' | 'moderated'>('triage')
  const [tracked, setTracked] = useState<TrackedImprovement[]>([])
  const [trackingEdit, setTrackingEdit] = useState<Record<number, Partial<TrackedImprovement>>>({})
  const [expandedTrackingId, setExpandedTrackingId] = useState<number | null>(null)
  const [savingTracking, setSavingTracking] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/triage')
      .then((r) => {
        if (r.status === 403) { router.push('/board'); return null }
        return r.json()
      })
      .then((d) => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [router])

  // Session inactivity timeout — warn at 110 min, log out at 120 min
  useEffect(() => {
    const WARN_MS = 110 * 60 * 1000
    const LOGOUT_MS = 120 * 60 * 1000
    let warnTimer: ReturnType<typeof setTimeout>
    let logoutTimer: ReturnType<typeof setTimeout>

    function resetTimers() {
      setSessionWarning(false)
      clearTimeout(warnTimer)
      clearTimeout(logoutTimer)
      warnTimer = setTimeout(() => setSessionWarning(true), WARN_MS)
      logoutTimer = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/?reason=timeout')
      }, LOGOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetTimers))
    resetTimers()

    return () => {
      clearTimeout(warnTimer)
      clearTimeout(logoutTimer)
      events.forEach((e) => window.removeEventListener(e, resetTimers))
    }
  }, [router])

  async function fetchAuditLog(id: number) {
    const res = await fetch(`/api/triage/audit?id=${id}`)
    const data = await res.json()
    setAuditLog((prev) => ({ ...prev, [id]: data.log ?? [] }))
  }

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

  const [sidePanelId, setSidePanelId] = useState<number | null>(null)
  const [auditLog, setAuditLog] = useState<Record<number, AuditEntry[]>>({})
  const [sessionWarning, setSessionWarning] = useState(false)

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



  const TARGET_DATE_STATUSES = new Set(['under_consideration', 'approved', 'in_plan'])

  async function updateField(id: number, field: 'score_override' | 'status' | 'category' | 'suggested_owner', value: string, extra?: Record<string, string>) {
    setUpdating(id)
    await fetch('/api/triage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value, ...extra }),
    })
    setData((prev) => prev ? {
      ...prev,
      submissions: prev.submissions.map((s) => s.id === id ? {
        ...s,
        score_override: value !== '' ? Number(value) : null,
        score_override_reason: extra?.score_override_reason ?? s.score_override_reason ?? null,
        score_override_by: extra?.score_override_by ?? s.score_override_by ?? null,
      } : s),
    } : prev)
    setAuditLog((prev) => { const n = { ...prev }; delete n[id]; return n })
    fetchAuditLog(id)
    setUpdating(null)
    setSavedId(id)
    setTimeout(() => setSavedId(null), 2000)
  }

  async function savePanel(id: number, draft: { status: string; suggested_owner: string; category: string; confirmed_target_date: string; confirmed_cost: string; notes: string }) {
    setUpdating(id)
    await fetch('/api/triage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: draft.status,
        suggested_owner: draft.suggested_owner,
        category: draft.category,
        confirmed_target_date: draft.confirmed_target_date,
        confirmed_cost: draft.confirmed_cost,
        notes: draft.notes,
      }),
    })
    const prev = data?.submissions.find((s) => s.id === id)
    setData((d) => d ? {
      ...d,
      submissions: d.submissions.map((s) => s.id === id ? {
        ...s,
        status: draft.status,
        suggested_owner: draft.suggested_owner || null,
        category: draft.category,
        confirmed_target_date: draft.confirmed_target_date || null,
        confirmed_cost: draft.confirmed_cost !== '' ? Number(draft.confirmed_cost) : null,
        notes: draft.notes || null,
        decision_authority: roleToAuthority(d.role),
        decision_by: d.directorName,
      } : s),
    } : d)
    if (draft.status !== prev?.status) {
      setAuditLog((a) => { const n = { ...a }; delete n[id]; return n })
      fetchAuditLog(id)
    }
    setUpdating(null)
    setSavedId(id)
    setTimeout(() => setSavedId(null), 2500)
    if (draft.status === 'approved' || draft.status === 'implemented') refreshTracking()
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/board')
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
      if (filterOwner === 'board_members' && !s.from_board) return false
      if (filterOwner !== 'all' && filterOwner !== 'board_members' && s.suggested_owner !== filterOwner) return false
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
      <InstallPrompt />
      {/* Header */}
      <div className="bramley-card">
        <BramleyHeader
          subtitle={`${data.directorName} — ${data.role}`}
          below={
            <div className="flex gap-4 items-center">
              <button onClick={() => router.push('/submit')} className="text-xs opacity-70 hover:opacity-100">Submit an improvement</button>
              {data.isManager && (
                <button onClick={() => router.push('/admin')} className="text-xs opacity-70 hover:opacity-100">Admin</button>
              )}
              <button onClick={handleLogout} className="text-xs opacity-70 hover:opacity-100">Sign out</button>
            </div>
          }
          right={<FullscreenButton />}
        />
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

      {/* Session timeout warning */}
      {sessionWarning && (
        <div className="bramley-card border-2 border-amber-400 bg-amber-50">
          <div className="bramley-body flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-800">⏱ Your session will expire in 10 minutes due to inactivity. Move your mouse or press a key to stay signed in.</p>
            <button onClick={() => setSessionWarning(false)} className="text-amber-500 hover:text-amber-700 shrink-0">✕</button>
          </div>
        </div>
      )}

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
              <option value="cost_threshold">£ Board approval</option>
            </select>
          </div>
          {ownerOptions.length > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <label className="text-xs text-gray-500 shrink-0">Owner</label>
              <select className="bramley-input text-sm py-1.5 flex-1" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                <option value="all">All owners</option>
                <option value="board_members">🏛 Board submissions</option>
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
      {tab === 'triage' && (
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
            const s = data.submissions.find(x => x.id === sidePanelId)
            if (!s) return null
            return (
              <SpreadsheetDetailPanel
                s={s}
                isManager={data.isManager}
                myRole={data.role}
                onUpdate={updateField}
                onSave={savePanel}
                onDelete={deleteImprovement}
                onClose={() => setSidePanelId(null)}
                updating={updating === s.id}
                saved={savedId === s.id}
                deleting={deleting === s.id}
                auditLog={auditLog[s.id] ?? []}
                onOpen={() => fetchAuditLog(s.id)}
              />
            )
          })()}
        </div>
      )}

      {/* ── Tracking tab ───────────────────────────────────────────── */}
      {tab === 'tracking' && (
        <div className="bramley-card overflow-hidden">
          {filteredTracked.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-gray-500 text-sm">{filterCategory === 'all' ? 'No approved or implemented improvements yet.' : 'No items in this area.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'var(--bramley-primary)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 w-28">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80">Improvement</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden sm:table-cell w-36">Category</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden md:table-cell w-28">Target date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden lg:table-cell w-36">Responsible</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden lg:table-cell w-24">Actual cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredTracked.map((t, i) => {
                  const isExpanded = expandedTrackingId === t.id
                  return (
                    <>
                      <tr
                        key={t.id}
                        onClick={() => setExpandedTrackingId(isExpanded ? null : t.id)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className={`bramley-badge ${t.status === 'implemented' ? 'status-implemented' : 'status-approved'}`}>
                            {STATUS_LABELS[t.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-gray-800 font-medium line-clamp-2">{t.ai_summary ?? t.description}</p>
                          {t.recognition !== 'anonymous' && t.member_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{t.member_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">
                          {CATEGORIES.find(c => c.value === t.category)?.label}
                          {t.score != null && <span className="block text-gray-400">Score {Number(t.score).toFixed(1)}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell whitespace-nowrap">
                          {t.target_date ? formatDate(t.target_date) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 hidden lg:table-cell">
                          {t.responsible_person ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 hidden lg:table-cell">
                          {t.actual_cost != null ? `£${Number(t.actual_cost).toLocaleString()}` : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>

                      {isExpanded && data.isManager && (
                        <tr key={`${t.id}-edit`} className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">
                                  Target date
                                  {t.suggested_target_date && !t.target_date && (
                                    <button
                                      onClick={() => editTracking(t.id, 'target_date', t.suggested_target_date!.substring(0, 10))}
                                      className="ml-1 text-blue-500 hover:text-blue-700 underline"
                                    >
                                      Use AI ({formatDate(t.suggested_target_date)})
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
                              <div className="col-span-2 md:col-span-4">
                                <label className="text-xs text-gray-500 block mb-1">Notes</label>
                                <textarea
                                  className="bramley-input resize-none text-sm"
                                  rows={2}
                                  placeholder="Progress notes, blockers, decisions…"
                                  value={trackingEdit[t.id]?.tracking_notes ?? t.tracking_notes ?? ''}
                                  onChange={(e) => editTracking(t.id, 'tracking_notes', e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {trackingEdit[t.id] && (
                                <button onClick={() => saveTracking(t.id)} style={{ width: 'auto' }} className="bramley-btn px-6 py-2 text-sm" disabled={savingTracking === t.id}>
                                  {savingTracking === t.id ? <span className="spinner" /> : 'Save'}
                                </button>
                              )}
                              {t.status === 'approved' && (
                                <button
                                  onClick={() => markComplete(t.id)}
                                  disabled={completing === t.id}
                                  style={{ width: 'auto', background: '#1e8449' }}
                                  className="bramley-btn px-6 py-2 text-sm"
                                >
                                  {completing === t.id ? <span className="spinner" /> : '✓ Mark as implemented'}
                                </button>
                              )}
                              <button onClick={() => setExpandedTrackingId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-3">Close</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Moderated tab ──────────────────────────────────────────── */}
      {tab === 'moderated' && data.isManager && (
        <div className="bramley-card overflow-hidden">
          {moderated.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-gray-500 text-sm">No moderated submissions.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'var(--bramley-primary)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 w-28">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80">Description</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden sm:table-cell w-36">Category</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 w-36">Reason</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden md:table-cell">Member</th>
                </tr>
              </thead>
              <tbody>
                {moderated.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-gray-800 font-medium line-clamp-2">{s.description}</p>
                      {s.benefit && <p className="text-xs text-gray-400 italic mt-0.5 line-clamp-1">"{s.benefit}"</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">
                      {CATEGORIES.find(c => c.value === s.category)?.label ?? s.category}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 whitespace-nowrap">
                        {s.moderation_reason?.replace(/_/g, ' ') ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell">{s.member_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">Submissions silently rejected by the AI moderation gate — members received a neutral response.</p>
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
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-24 hidden lg:table-cell">Impl</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-44 hidden lg:table-cell">Cost</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-24 hidden md:table-cell">Date</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-36">Decision</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide w-36 hidden lg:table-cell">Owner</th>
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
                  ) : <span className="text-amber-500 text-xs font-semibold" title="Awaiting overnight triage">⏳</span>}
                </td>

                {/* Summary */}
                <td className="py-1.5 px-2 max-w-0">
                  <p className="truncate font-medium text-gray-800">{s.ai_summary ?? s.description}</p>
                </td>

                {/* Area */}
                <td className="py-1.5 px-2 text-gray-500 hidden md:table-cell whitespace-nowrap">
                  {CATEGORIES.find(c => c.value === s.category)?.label ?? s.category}
                </td>

                {/* Impl */}
                <td className="py-1.5 px-2 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                  {s.impl_complexity
                    ? <span className={`capitalize ${s.quick_win_flag ? 'text-green-700 font-semibold' : ''}`}>{s.impl_complexity.replace('_', ' ')}</span>
                    : <span className="text-gray-300">—</span>}
                </td>

                {/* Cost */}
                <td className="py-1.5 px-2 hidden lg:table-cell whitespace-nowrap">
                  {s.confirmed_cost != null ? (
                    <span className="text-green-700 font-semibold text-xs" title="Confirmed cost target">🎯 £{Number(s.confirmed_cost).toLocaleString()}</span>
                  ) : s.cost_estimate_low != null && s.cost_estimate_high != null ? (
                    <span className="text-gray-400 text-xs" title="AI estimated cost">❓ £{Number(s.cost_estimate_low).toLocaleString()} – £{Number(s.cost_estimate_high).toLocaleString()}</span>
                  ) : s.cost_band ? (
                    <span className="text-gray-400 text-xs" title="AI estimated cost">❓ <span className="capitalize">{s.cost_band.replace('_', ' ')}</span></span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Date */}
                <td className="py-1.5 px-2 hidden md:table-cell whitespace-nowrap">
                  {s.confirmed_target_date ? (
                    <span className="text-green-700 font-semibold text-xs" title="Confirmed target date">🎯 {formatDate(s.confirmed_target_date)}</span>
                  ) : s.suggested_target_date ? (
                    <span className="text-gray-400 text-xs" title="AI estimated target date">❓ {formatDate(s.suggested_target_date)}</span>
                  ) : (
                    <span className="text-gray-400 text-xs">{formatDate(s.created_at)}</span>
                  )}
                </td>

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

                {/* Flags */}
                <td className="py-1.5 px-2 text-center hidden sm:table-cell">
                  <div className="flex gap-0.5 justify-center flex-wrap">
                    {s.h_and_s_flag && <span title="H&S" className="text-red-600">⚠</span>}
                    {s.quick_win_flag && <span title="Quick win">⚡</span>}
                    {s.revenue_opportunity && <span title="Revenue">💰</span>}
                    {s.cost_threshold_flag && <span title="Board approval" className="text-orange-600 font-bold text-xs">£</span>}
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

function Saved({ show }: { show: boolean }) {
  if (!show) return null
  return <span className="ml-2 text-green-600 text-xs font-semibold animate-pulse">✓ Saved</span>
}

function SpreadsheetDetailPanel({
  s, isManager, myRole, onUpdate, onSave, onDelete, onClose, updating, saved, deleting, auditLog, onOpen,
}: {
  s: Submission
  isManager: boolean
  myRole: string
  onUpdate: (id: number, field: 'score_override', value: string, extra?: Record<string, string>) => void
  onSave: (id: number, draft: { status: string; suggested_owner: string; category: string; confirmed_target_date: string; confirmed_cost: string; notes: string }) => void
  onDelete: (id: number) => void
  onClose: () => void
  updating: boolean
  saved: boolean
  deleting: boolean
  auditLog: AuditEntry[]
  onOpen: () => void
}) {
  useEffect(() => { onOpen() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [draft, setDraft] = useState({
    status: s.status,
    suggested_owner: s.suggested_owner ?? '',
    category: s.category,
    confirmed_target_date: s.confirmed_target_date ? s.confirmed_target_date.substring(0, 10) : '',
    confirmed_cost: s.confirmed_cost != null ? String(s.confirmed_cost) : '',
    notes: s.notes ?? '',
  })

  // Reset draft when a different submission is selected
  useEffect(() => {
    setDraft({
      status: s.status,
      suggested_owner: s.suggested_owner ?? '',
      category: s.category,
      confirmed_target_date: s.confirmed_target_date ? s.confirmed_target_date.substring(0, 10) : '',
      confirmed_cost: s.confirmed_cost != null ? String(s.confirmed_cost) : '',
      notes: s.notes ?? '',
    })
  }, [s.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = draft.status !== s.status
    || draft.suggested_owner !== (s.suggested_owner ?? '')
    || draft.category !== s.category
    || draft.confirmed_target_date !== (s.confirmed_target_date ? s.confirmed_target_date.substring(0, 10) : '')
    || draft.confirmed_cost !== (s.confirmed_cost != null ? String(s.confirmed_cost) : '')
    || draft.notes !== (s.notes ?? '')

  const aiDate = s.suggested_target_date ? s.suggested_target_date.substring(0, 10) : ''
  const aiLow = s.cost_estimate_low != null ? Number(s.cost_estimate_low) : null
  const aiHigh = s.cost_estimate_high != null ? Number(s.cost_estimate_high) : null
  const aiMid = aiLow != null && aiHigh != null ? Math.round((aiLow + aiHigh) / 2) : null

  // Ratification authority logic
  const myAuthority = roleToAuthority(myRole)
  const myAuthorityLevel = AUTHORITY_LEVELS[myAuthority] ?? 0
  const currentAuthorityLevel = AUTHORITY_LEVELS[s.decision_authority ?? ''] ?? 0
  const isLocked = currentAuthorityLevel > myAuthorityLevel
  const isPending = s.decision_authority === 'director'
  const isDirectorLevel = myAuthority === 'director'
  const canDecide = !isLocked

  const AUTHORITY_LABELS: Record<string, string> = {
    director: 'Director',
    operations_manager: 'Operations Manager',
    club_manager: 'Club Manager',
    chairman: 'Chair of the Board',
  }

  function SaveBtn({ className }: { className?: string }) {
    const label = isDirectorLevel ? 'Flag for ratification' : isPending ? 'Ratify & save' : 'Save changes'
    return (
      <button
        onClick={() => onSave(s.id, draft)}
        disabled={updating || !isDirty || isLocked}
        className={`bramley-btn py-1.5 text-xs px-4 ${className ?? ''}`}
        style={{ width: 'auto', opacity: (isDirty && canDecide) ? 1 : 0.35 }}
      >
        {updating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : isDirty ? label : saved ? '✓ Saved' : 'No changes'}
      </button>
    )
  }

  return (
    <div className="bramley-card w-80 xl:w-96 2xl:w-[440px] shrink-0 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="bramley-body space-y-4 text-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {s.score != null && (
              <span className="bramley-badge" style={{ background: scoreBandColor(s.score_band) }}>
                {Number(s.score).toFixed(1)}
              </span>
            )}
            <span className="text-xs text-gray-500">{CATEGORIES.find(c => c.value === s.category)?.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SaveBtn />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
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
          {s.cost_threshold_flag && <span className="bramley-badge text-xs" style={{ background: '#d35400' }}>£ Board</span>}
          {s.needs_external_approval && <span className="bramley-badge text-xs" style={{ background: '#7d6608' }}>⚖ Approval</span>}
          {s.suggested_owner && <span className="bramley-badge text-xs" style={{ background: '#117a65' }}>👤 {s.suggested_owner}</span>}
          {s.seasonal_window && <span className="bramley-badge text-xs" style={{ background: '#1a5276' }}>📅 Seasonal</span>}
          {s.recurring_flag && <span className="bramley-badge text-xs" style={{ background: '#922b21' }}>🔁 Recurring ×{s.recurring_run_count + 1}</span>}
          {s.cluster_theme && <span className="bramley-badge text-xs" style={{ background: '#2471a3' }}>Cluster ({s.cluster_size})</span>}
        </div>

        {/* Awaiting triage notice */}
        {s.score == null && (
          <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <span className="font-semibold">⏳ Awaiting overnight triage</span>
            <p className="mt-1 text-amber-700">This submission has not yet been scored. It will be assessed, clustered and scored in the next scheduled overnight run.</p>
          </div>
        )}

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
              <p>
                <span className="font-semibold text-gray-500">AI target:</span>{' '}
                <span className="text-gray-500">❓ {new Date(s.suggested_target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
            )}
            {s.strategic_note && <p className="text-gray-600 italic">{s.strategic_note}</p>}
            {s.cluster_theme && <p><span className="font-semibold text-blue-600">Cluster:</span> {s.cluster_theme} ({s.cluster_size})</p>}
            {s.seasonal_window && <p><span className="font-semibold text-gray-500">Seasonal:</span> {s.seasonal_window}</p>}
            {s.revenue_note && <p><span className="font-semibold text-purple-600">Revenue:</span> {s.revenue_note}</p>}
            {s.approval_body && <p><span className="font-semibold text-gray-500">Approval:</span> {s.approval_body}</p>}
          </div>
        )}

        {/* Board Decision — visible to all directors, locked by ratification hierarchy */}
        <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-bold text-amber-700 uppercase tracking-wider">📋 Board Decision</p>
            {isPending && !isDirectorLevel && (
              <span className="text-xs font-semibold text-orange-600 bg-orange-100 border border-orange-200 rounded px-2 py-0.5">⏳ Pending ratification</span>
            )}
            {isPending && isDirectorLevel && (
              <span className="text-xs font-semibold text-orange-600 bg-orange-100 border border-orange-200 rounded px-2 py-0.5">⏳ Awaiting ratification</span>
            )}
            {s.decision_authority && !isPending && s.decision_by && (
              <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 rounded px-2 py-0.5">
                ✓ {AUTHORITY_LABELS[s.decision_authority] ?? s.decision_authority}
              </span>
            )}
          </div>

          {isLocked && (
            <p className="text-xs text-gray-500 italic">
              Decision set by {s.decision_by} ({AUTHORITY_LABELS[s.decision_authority ?? ''] ?? s.decision_authority}). Higher authority required to change.
            </p>
          )}

          <div>
            <label className="text-gray-500 block mb-1">Status</label>
            <select className="bramley-input text-xs py-1 w-full" value={draft.status} onChange={(e) => setDraft(d => ({ ...d, status: e.target.value }))} disabled={updating || isLocked}>
              {Object.entries(STATUS_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-gray-500 block mb-1">Owner</label>
            <select className="bramley-input text-xs py-1 w-full" value={draft.suggested_owner} onChange={(e) => setDraft(d => ({ ...d, suggested_owner: e.target.value }))} disabled={updating || isLocked}>
              <option value="">— Unassigned —</option>
              {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="text-gray-500 block mb-1">Area</label>
            <select className="bramley-input text-xs py-1 w-full" value={draft.category} onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))} disabled={updating || isLocked}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Target date
              {draft.confirmed_target_date && <span className="ml-1 text-green-600">✓ confirmed</span>}
            </label>
            <div className="flex gap-1 items-center flex-wrap">
              <input type="date" className="bramley-input text-sm py-1.5 w-36" value={draft.confirmed_target_date} onChange={(e) => setDraft(d => ({ ...d, confirmed_target_date: e.target.value }))} disabled={updating || isLocked} />
              {draft.confirmed_target_date && !isLocked && <button onClick={() => setDraft(d => ({ ...d, confirmed_target_date: '' }))} className="text-xs text-gray-400 hover:text-red-500" title="Clear">✕</button>}
            </div>
            {aiDate && !draft.confirmed_target_date && !isLocked && (
              <button onClick={() => setDraft(d => ({ ...d, confirmed_target_date: aiDate }))} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                Use AI estimate ({new Date(aiDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})
              </button>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Cost target (£)
              {draft.confirmed_cost && <span className="ml-1 text-green-600">✓ confirmed</span>}
            </label>
            <div className="flex gap-1 items-center flex-wrap">
              <input type="number" min="0" step="1" className="bramley-input text-sm py-1.5 w-32" placeholder="e.g. 2500" value={draft.confirmed_cost} onChange={(e) => setDraft(d => ({ ...d, confirmed_cost: e.target.value }))} disabled={updating || isLocked} />
              {draft.confirmed_cost && !isLocked && <button onClick={() => setDraft(d => ({ ...d, confirmed_cost: '' }))} className="text-xs text-gray-400 hover:text-red-500" title="Clear">✕</button>}
            </div>
            {aiMid != null && !draft.confirmed_cost && !isLocked && (
              <button onClick={() => setDraft(d => ({ ...d, confirmed_cost: String(aiMid) }))} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                Use AI midpoint (£{aiMid.toLocaleString()})
              </button>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Board notes</label>
            <textarea rows={3} className="bramley-input text-xs py-1 w-full resize-none" placeholder="Notes visible to all directors…" value={draft.notes} onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))} disabled={updating || isLocked} />
          </div>

          <div className="flex items-center justify-between pt-1">
            <SaveBtn />
            {isManager && (
              <button onClick={() => onDelete(s.id)} disabled={deleting} className="text-red-500 hover:text-red-700 text-xs font-semibold">
                {deleting ? 'Removing…' : '✕ Remove'}
              </button>
            )}
          </div>
        </div>

        {isManager && (
          <ScoreOverridePanel s={s} onUpdate={onUpdate} updating={updating} />
        )}

        {auditLog.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Activity log</p>
            <div className="space-y-1">
              {auditLog.map((entry, i) => <AuditRow key={i} entry={entry} />)}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          {s.recognition !== 'anonymous' && s.member_name && <>Submitted by {s.member_name} · </>}
          {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────────

function ScoreOverridePanel({ s, onUpdate, updating }: {
  s: Submission
  onUpdate: (id: number, field: 'score_override', value: string, extra?: Record<string, string>) => void
  updating: boolean
}) {
  const [overrideVal, setOverrideVal] = useState(s.score_override != null ? String(s.score_override) : '')
  const [reason, setReason] = useState(s.score_override_reason ?? '')
  const [editing, setEditing] = useState(false)

  return (
    <div className="mt-2 rounded-[8px] border border-gray-200 bg-white p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-500 uppercase tracking-wide">Score override</span>
        {s.score_override != null && (
          <span className="text-gray-400 italic">Overridden by {s.score_override_by}</span>
        )}
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-blue-500 hover:text-blue-700">
            {s.score_override != null ? 'Edit' : '+ Override'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">AI score:</span>
        <span className="font-semibold">{s.score != null ? Number(s.score).toFixed(1) : '—'}</span>
        {s.score_override != null && (
          <>
            <span className="text-gray-400">→</span>
            <span className="font-semibold text-amber-700">{Number(s.score_override).toFixed(1)} (override)</span>
          </>
        )}
      </div>
      {editing && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <label className="text-gray-500 shrink-0">New score (0–10):</label>
            <input
              type="number" min="0" max="10" step="0.1"
              className="bramley-input text-xs py-0.5 w-20"
              value={overrideVal}
              onChange={(e) => setOverrideVal(e.target.value)}
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Reason (required):</label>
            <input
              type="text"
              className="bramley-input text-xs py-0.5 w-full"
              placeholder="Why is the AI score being overridden?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={updating || !reason.trim() || overrideVal === ''}
              onClick={() => {
                onUpdate(s.id, 'score_override', overrideVal, { score_override_reason: reason })
                setEditing(false)
              }}
              className="bramley-btn py-1 text-xs"
            >Save override</button>
            {s.score_override != null && (
              <button
                disabled={updating}
                onClick={() => {
                  onUpdate(s.id, 'score_override', '', { score_override_reason: '' })
                  setOverrideVal('')
                  setReason('')
                  setEditing(false)
                }}
                className="text-red-500 hover:text-red-700 text-xs"
              >Remove override</button>
            )}
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const isScoreOverride = entry.note?.startsWith('Score overridden')
  return (
    <div className="flex items-start gap-2 text-xs text-gray-500">
      <span className="shrink-0 mt-0.5">{isScoreOverride ? '🎯' : '↻'}</span>
      <div>
        <span className="font-medium text-gray-700">{entry.changed_by}</span>
        {isScoreOverride
          ? <span> {entry.note}</span>
          : <span> changed status to <span className="font-medium text-gray-700">{STATUS_LABELS[entry.new_status] ?? entry.new_status}</span></span>
        }
        {entry.note && !isScoreOverride && <span className="text-gray-400"> · {entry.note}</span>}
        <span className="text-gray-400 ml-1">· {fmt(entry.changed_at)}</span>
      </div>
    </div>
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
