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
    const data = await res.json()
    setTracked((prev) => prev.map((t) => t.id === id ? { ...t, status: 'implemented' } : t))
    if (data.recognitionRequired && data.memberName) {
      setRecognitionAlert(`${data.memberName} is eligible for recognition. Please follow up via the recognition workflow.`)
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

  async function updateField(id: number, field: 'status' | 'category', value: string) {
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
    // Keep tracking in sync whenever an item is approved or implemented
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

  // Only hide silently moderated items (political/personal) from main triage view
  const moderated = data.submissions.filter((s) => s.moderation_reason)
  const triageItems = data.submissions.filter((s) => !s.moderation_reason)
  const urgent = triageItems.filter((s) => s.h_and_s_flag)
  const normal = triageItems.filter((s) => !s.h_and_s_flag)

  const byCategory = CATEGORIES.reduce<Record<string, Submission[]>>((acc, cat) => {
    const subs = normal.filter((s) => s.category === cat.value)
    if (subs.length > 0) acc[cat.value] = subs
    return acc
  }, {})

  const tabCount = {
    triage: triageItems.filter(s => s.status === 'new' || s.status === 'under_consideration').length,
    tracking: 0,
    moderated: moderated.length,
  }

  return (
    <div className="w-full max-w-3xl lg:max-w-5xl mx-auto space-y-4">
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
                  <span className="ml-1.5 bg-bramley-blue text-white text-xs rounded-full px-1.5 py-0.5" style={{background:'#2471a3'}}>{tabCount.triage}</span>
                )}
              </button>
            ))}
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

      {/* Tracking tab */}
      {tab === 'tracking' && (
        <div className="bramley-card">
          <div className="bramley-body">
            {tracked.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No approved or implemented improvements yet.</p>
            ) : (
              <div className="space-y-4">
                {tracked.map((t) => (
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
                                Use AI suggestion ({new Date(t.suggested_target_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})})
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
                            <button
                              onClick={() => saveTracking(t.id)}
                              className="bramley-btn py-2 text-sm"
                              disabled={savingTracking === t.id}
                            >
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

      {/* Moderated tab — Club Manager only */}
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

      {/* Triage tab */}
      {tab === 'triage' && urgent.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-600 uppercase tracking-wide px-1 mb-2">
            ⚠️ Urgent — Health &amp; Safety
          </h2>
          {urgent.map((s) => (
            <SubmissionRow
              key={s.id}
              s={s}
              expanded={expanded.has(s.id)}
              onToggle={() => toggleExpand(s.id)}
              isManager={data.isManager}
              onUpdate={updateField}
              onDelete={deleteImprovement}
              updating={updating === s.id}
              deleting={deleting === s.id}
              urgent
              formatDate={formatDate}
            />
          ))}
        </section>
      )}

      {/* By category */}
      {tab === 'triage' && CATEGORIES.filter((c) => byCategory[c.value]).map((cat) => (
        <section key={cat.value}>
          <h2 className="text-sm font-bold uppercase tracking-wide px-1 mb-2" style={{ color: 'var(--bramley-navy)' }}>
            {cat.label} <span className="font-normal text-gray-400">({byCategory[cat.value].length})</span>
          </h2>
          {byCategory[cat.value].map((s) => (
            <SubmissionRow
              key={s.id}
              s={s}
              expanded={expanded.has(s.id)}
              onToggle={() => toggleExpand(s.id)}
              isManager={data.isManager}
              onUpdate={updateField}
              onDelete={deleteImprovement}
              updating={updating === s.id}
              deleting={deleting === s.id}
              formatDate={formatDate}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function SubmissionRow({
  s, expanded, onToggle, isManager, onUpdate, onDelete, updating, deleting, urgent, formatDate,
}: {
  s: Submission
  expanded: boolean
  onToggle: () => void
  isManager: boolean
  onUpdate: (id: number, field: 'status' | 'category', value: string) => void
  onDelete: (id: number) => void
  updating: boolean
  deleting: boolean
  urgent?: boolean
  formatDate: (iso: string) => string
}) {
  return (
    <div className={`border rounded-[10px] mb-2 overflow-hidden ${urgent ? 'border-red-300' : 'border-gray-200'}`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
      >
        {s.score != null && (
          <span
            className="bramley-badge shrink-0 mt-0.5"
            style={{ background: scoreBandColor(s.score_band) }}
          >
            {Number(s.score).toFixed(1)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {s.ai_summary ?? s.description}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-500">{formatDate(s.created_at)}</span>
            {s.quick_win_flag && (
              <span className="bramley-badge text-xs" style={{ background: '#1e8449' }}>⚡ Quick win</span>
            )}
            {s.cost_threshold_flag && (
              <span className="bramley-badge text-xs" style={{ background: '#d35400' }}>£ Committee review</span>
            )}
            {s.cluster_theme && (
              <span className="bramley-badge text-xs" style={{ background: '#2471a3' }}>
                Cluster ({s.cluster_size})
              </span>
            )}
            <span className={`bramley-badge text-xs ${statusClass(s.status)}`}>
              {STATUS_LABELS[s.status] ?? s.status}
            </span>
          </div>
        </div>
        <span className="text-gray-400 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 space-y-3 pt-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Improvement</p>
            <p className="text-sm text-gray-800">{s.description}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Perceived benefit</p>
            <p className="text-sm text-gray-700">{s.benefit}</p>
          </div>
          {s.ai_narrative && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assessment</p>
              <p className="text-sm text-gray-700">{s.ai_narrative}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Cost estimate */}
            {(s.cost_estimate_low != null || s.cost_band) && (
              <div className={`rounded-[8px] px-3 py-2 col-span-2 ${s.cost_threshold_flag ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
                <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Cost estimate {s.cost_confidence && <span className="normal-case font-normal text-gray-400">({s.cost_confidence} confidence)</span>}
                </span>
                <div className="flex items-baseline gap-2">
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

            {/* Implementation time */}
            {s.impl_complexity && (
              <div className={`rounded-[8px] px-3 py-2 ${s.quick_win_flag ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-1">Implementation</span>
                <span className={`font-semibold capitalize ${s.quick_win_flag ? 'text-green-700' : 'text-gray-800'}`}>
                  {s.impl_complexity.replace('_', ' ')}
                </span>
                {s.impl_weeks_low != null && s.impl_weeks_high != null && (
                  <p className="text-gray-500 mt-0.5">
                    {s.impl_weeks_low === s.impl_weeks_high
                      ? `~${s.impl_weeks_low} week${s.impl_weeks_low !== 1 ? 's' : ''}`
                      : `${s.impl_weeks_low}–${s.impl_weeks_high} weeks`}
                  </p>
                )}
                {s.suggested_target_date && (
                  <p className="text-gray-400 mt-0.5">Suggested target: {new Date(s.suggested_target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                )}
              </div>
            )}

            {s.strategic_note && (
              <div className="bg-gray-50 rounded-[8px] px-3 py-2 col-span-2">
                <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Strategic alignment</span>
                <span className="text-gray-800">{s.strategic_note}</span>
              </div>
            )}
            {s.cluster_theme && (
              <div className="bg-blue-50 rounded-[8px] px-3 py-2 col-span-2">
                <span className="font-semibold text-blue-600 uppercase tracking-wide block mb-0.5">Cluster theme</span>
                <span className="text-blue-800">{s.cluster_theme} ({s.cluster_size} submission{s.cluster_size !== 1 ? 's' : ''})</span>
              </div>
            )}
          </div>

          {/* Member attribution (respect recognition preference) */}
          {s.recognition !== 'anonymous' && s.member_name && (
            <p className="text-xs text-gray-400">
              {s.recognition === 'public' ? 'Submitted by ' : 'Member (committee only): '}
              <span className="font-medium">{s.member_name}</span>
            </p>
          )}

          {/* Manager controls */}
          {isManager && (
            <div className="flex gap-2 pt-1 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <select
                  className="bramley-input text-sm py-1.5"
                  value={s.status}
                  onChange={(e) => onUpdate(s.id, 'status', e.target.value)}
                  disabled={updating}
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-gray-500 block mb-1">Category</label>
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
                <div className="w-full pt-1">
                  <button
                    onClick={() => onDelete(s.id)}
                    disabled={deleting}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    {deleting ? 'Removing…' : 'Remove improvement'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function scoreBandColor(band: string | null): string {
  const map: Record<string, string> = {
    priority: '#0d5d3d',
    active: '#1e8449',
    holding: '#b7770d',
    low_priority: '#888',
    not_progressed: '#aaa',
    in_plan: '#2471a3',
  }
  return map[band ?? ''] ?? '#888'
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    new: 'status-new',
    under_consideration: 'status-under_consideration',
    approved: 'status-approved',
    implemented: 'status-implemented',
    rejected: 'status-rejected',
  }
  return map[status] ?? 'status-new'
}
