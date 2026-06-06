'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, STATUS_LABELS } from '@/lib/categories'
import BramleyHeader from '@/components/BramleyHeader'

interface HistoryEntry {
  new_status: string
  changed_at: string
}

interface Improvement {
  id: number
  description: string
  category: string
  status: string
  member_msg: string | null
  score_band: string | null
  cost_band: string | null
  impl_complexity: string | null
  suggested_target_date: string | null
  confirmed_target_date: string | null
  quick_win_flag: boolean
  scored_at: string | null
  created_at: string
  withdrawn_at: string | null
  history: HistoryEntry[]
}

const BAND_LABELS: Record<string, { label: string; color: string }> = {
  priority:       { label: 'Priority — high likelihood of implementation', color: '#0d5d3d' },
  active:         { label: 'Active queue — under consideration',           color: '#1e8449' },
  holding:        { label: 'Holding — good idea, longer timeframe',        color: '#b7770d' },
  low_priority:   { label: 'Low priority at this time',                    color: '#888'    },
  not_progressed: { label: 'Not progressed',                               color: '#aaa'    },
  in_plan:        { label: 'Already in our improvement plan',              color: '#2471a3' },
}

const WARN_AT = 110 * 60 * 1000
const LOGOUT_AT = 120 * 60 * 1000

export default function MyImprovementsPage() {
  const router = useRouter()
  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Redirect directors to triage — they need a member session for this page
  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (!s.authenticated) router.replace('/')
      if (s.type === 'director') router.replace('/triage')
    })
  }, [router])

  // Session timeout
  useEffect(() => {
    let warnTimer: ReturnType<typeof setTimeout>
    let logoutTimer: ReturnType<typeof setTimeout>
    function reset() {
      clearTimeout(warnTimer); clearTimeout(logoutTimer)
      setSessionWarning(false)
      warnTimer   = setTimeout(() => setSessionWarning(true), WARN_AT)
      logoutTimer = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/?timeout=1')
      }, LOGOUT_AT)
    }
    reset()
    const events = ['mousemove', 'keydown', 'click', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(warnTimer); clearTimeout(logoutTimer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [router])

  useEffect(() => {
    const t = setTimeout(() => {}, 0)
    clearTimeout(t)
  }, [])

  const fetchRef = useRef(false)
  useEffect(() => {
    if (fetchRef.current) return
    fetchRef.current = true
    fetch('/api/my-suggestions')
      .then((r) => {
        if (r.status === 401) { router.push('/'); return null }
        return r.json()
      })
      .then((data) => {
        if (data) setImprovements(data.suggestions)
      })
      .finally(() => setLoading(false))
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  async function handleWithdraw(s: Improvement) {
    if (!confirm(`Withdraw this improvement idea?\n\n"${s.description}"\n\nThis cannot be undone.`)) return
    setWithdrawingId(s.id)
    const res = await fetch('/api/my-suggestions/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id }),
    })
    if (res.ok) {
      setImprovements((prev) => prev.map((i) => i.id === s.id ? { ...i, status: 'withdrawn', withdrawn_at: new Date().toISOString() } : i))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not withdraw — please try again.')
    }
    setWithdrawingId(null)
  }

  function categoryLabel(val: string) {
    return CATEGORIES.find((c) => c.value === val)?.label ?? val
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  return (
    <div className="bramley-wide-page"><div className="bramley-card">
      <BramleyHeader subtitle="My improvements" />

      {sessionWarning && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-300 rounded-[8px] px-4 py-3 text-sm text-amber-800">
          ⚠️ Your session will expire in 10 minutes due to inactivity. Move your mouse or press a key to stay signed in.
        </div>
      )}

      <div className="bramley-body space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
          </div>
        ) : improvements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>You haven&apos;t submitted any improvements yet.</p>
          </div>
        ) : (
          improvements.map((s) => {
            const band = s.score_band ? BAND_LABELS[s.score_band] : null
            const assessed = !!s.scored_at
            const isWithdrawn = s.status === 'withdrawn'
            const canWithdraw = !isWithdrawn && s.status !== 'implemented'
            const isExpanded = expandedId === s.id
            const targetDate = s.confirmed_target_date ?? s.suggested_target_date

            return (
              <div key={s.id} className={`border rounded-[10px] overflow-hidden ${isWithdrawn ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
                {/* Header row */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span className={`bramley-badge ${statusClass(s.status)}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{s.description}</p>
                  <p className="text-xs text-gray-500">{categoryLabel(s.category)}</p>

                  <div className="flex flex-wrap gap-2 items-center">
                    {s.quick_win_flag && !isWithdrawn && (
                      <span className="bramley-badge text-xs" style={{ background: '#1e8449' }}>⚡ Quick win</span>
                    )}
                    {band && !isWithdrawn && (
                      <span className="bramley-badge text-xs" style={{ background: band.color }}>{band.label}</span>
                    )}
                  </div>
                </div>

                {/* Assessment panel */}
                {!isWithdrawn && assessed ? (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Assessment {s.scored_at ? `· ${formatDate(s.scored_at)}` : ''}
                      </p>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {isExpanded ? 'Hide history ▲' : 'Show history ▼'}
                      </button>
                    </div>

                    {s.member_msg && (
                      <p className="text-sm text-gray-700 leading-relaxed">{s.member_msg}</p>
                    )}

                    {targetDate && (
                      <p className="text-xs text-gray-500">
                        {s.confirmed_target_date ? 'Target date' : 'Indicative timeline'}: <strong>{formatDate(targetDate)}</strong>
                        {s.confirmed_target_date && <span className="ml-1 text-green-600 font-semibold">✓ confirmed</span>}
                      </p>
                    )}

                    {/* Status history timeline */}
                    {isExpanded && s.history.length > 0 && (
                      <div className="mt-2 border-t border-gray-200 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status history</p>
                        <ol className="space-y-1">
                          {s.history.map((h, i) => (
                            <li key={i} className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                              <span className="font-medium">{STATUS_LABELS[h.new_status] ?? h.new_status}</span>
                              <span className="text-gray-400">{formatDate(h.changed_at)}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : isWithdrawn ? (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-400 italic">
                      Withdrawn {s.withdrawn_at ? formatDate(s.withdrawn_at) : ''}
                    </p>
                  </div>
                ) : s.status === 'rejected' ? (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-500 italic">Thank you for your submission. We were unable to progress this one through the improvement programme. If you have a concern to raise directly, please contact the Club Manager.</p>
                  </div>
                ) : (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-400 italic">Assessment pending — usually within 24 hours.</p>
                  </div>
                )}

                {/* Withdrawal button */}
                {canWithdraw && (
                  <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
                    <button
                      onClick={() => handleWithdraw(s)}
                      disabled={withdrawingId === s.id}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      {withdrawingId === s.id ? 'Withdrawing…' : 'Withdraw this idea'}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}

        <button onClick={() => router.push('/submit')} className="bramley-btn">
          Submit an improvement
        </button>
        <button onClick={handleLogout} className="text-sm text-gray-400 w-full py-2 hover:text-gray-600">
          Sign out
        </button>
      </div>
    </div></div>
  )
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    new: 'status-new',
    under_consideration: 'status-under_consideration',
    approved: 'status-approved',
    implemented: 'status-implemented',
    rejected: 'status-rejected',
    in_plan: 'status-new',
    withdrawn: 'status-rejected',
  }
  return map[status] ?? 'status-new'
}
