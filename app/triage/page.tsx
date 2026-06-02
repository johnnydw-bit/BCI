'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, STATUS_LABELS } from '@/lib/categories'

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
  strategic_note: string | null
  recognition: string
  member_name: string | null
  cluster_theme: string | null
  cluster_size: number | null
  created_at: string
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

  useEffect(() => {
    fetch('/api/triage')
      .then((r) => {
        if (r.status === 403) { router.push('/'); return null }
        return r.json()
      })
      .then((d) => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [router])

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
        <div className="bramley-header">⛳ Bramley Golf Club — Triage</div>
        <div className="bramley-body flex justify-center py-12">
          <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  if (!data) return null

  const urgent = data.submissions.filter((s) => s.h_and_s_flag)
  const normal = data.submissions.filter((s) => !s.h_and_s_flag)

  const byCategory = CATEGORIES.reduce<Record<string, Submission[]>>((acc, cat) => {
    const subs = normal.filter((s) => s.category === cat.value)
    if (subs.length > 0) acc[cat.value] = subs
    return acc
  }, {})

  return (
    <div className="w-full max-w-3xl lg:max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="bramley-card">
        <div className="bramley-header flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">⛳ Triage Report</h1>
            <p className="text-sm opacity-80 mt-0.5">{data.directorName} — {data.role}</p>
          </div>
          <button onClick={handleLogout} className="text-xs opacity-70 hover:opacity-100">Sign out</button>
        </div>
        <div className="bramley-body">
          <p className="text-sm text-gray-600">
            {data.submissions.length} improvement{data.submissions.length !== 1 ? 's' : ''} in this view
            {urgent.length > 0 && <span className="ml-2 text-red-600 font-semibold">· {urgent.length} urgent H&amp;S</span>}
          </p>
        </div>
      </div>

      {/* Urgent H&S */}
      {urgent.length > 0 && (
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
              updating={updating === s.id}
              urgent
              formatDate={formatDate}
            />
          ))}
        </section>
      )}

      {/* By category */}
      {CATEGORIES.filter((c) => byCategory[c.value]).map((cat) => (
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
              updating={updating === s.id}
              formatDate={formatDate}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function SubmissionRow({
  s, expanded, onToggle, isManager, onUpdate, updating, urgent, formatDate,
}: {
  s: Submission
  expanded: boolean
  onToggle: () => void
  isManager: boolean
  onUpdate: (id: number, field: 'status' | 'category', value: string) => void
  updating: boolean
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
            {s.score.toFixed(1)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {s.ai_summary ?? s.description}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-500">{formatDate(s.created_at)}</span>
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
            {s.cost_band && (
              <div className="bg-gray-50 rounded-[8px] px-3 py-2">
                <span className="font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Cost band</span>
                <span className="text-gray-800 capitalize">{s.cost_band.replace('_', ' ')}</span>
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
