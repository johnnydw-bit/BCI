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
  priority:       { label: 'Priority',        color: '#0d5d3d' },
  active:         { label: 'Active queue',    color: '#1e8449' },
  holding:        { label: 'Holding',         color: '#b7770d' },
  low_priority:   { label: 'Low priority',    color: '#888'    },
  not_progressed: { label: 'Not progressed',  color: '#aaa'    },
  in_plan:        { label: 'Already in plan', color: '#2471a3' },
}

const WARN_AT   = 110 * 60 * 1000
const LOGOUT_AT = 120 * 60 * 1000

export default function MyImprovementsPage() {
  const router = useRouter()
  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Require member session
  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (!s.authenticated || s.type !== 'member') router.replace('/')
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

  const fetchRef = useRef(false)
  useEffect(() => {
    if (fetchRef.current) return
    fetchRef.current = true
    fetch('/api/my-suggestions')
      .then((r) => {
        if (r.status === 401) { router.push('/'); return null }
        return r.json()
      })
      .then((data) => { if (data) setImprovements(data.suggestions) })
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
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="bramley-wide-page space-y-4">
      <div className="bramley-card">
        <BramleyHeader
          subtitle="My improvements"
          below={
            <div className="flex gap-4">
              <button onClick={handleLogout} className="text-xs opacity-70 hover:opacity-100">Sign out</button>
            </div>
          }
          right={
            <button
              onClick={() => router.push('/submit')}
              className="bramley-btn text-sm px-5 py-2"
              style={{ width: 'auto' }}
            >
              + Submit an improvement
            </button>
          }
        />
      </div>

      {sessionWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-[8px] px-4 py-3 text-sm text-amber-800">
          ⚠️ Your session will expire in 10 minutes due to inactivity.
        </div>
      )}

      <div className="bramley-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
          </div>
        ) : improvements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>You haven&apos;t submitted any improvements yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--bramley-primary)' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 w-28">Submitted</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80">Improvement</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden sm:table-cell w-36">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 w-32">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white opacity-80 hidden md:table-cell w-36">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {improvements.map((s, i) => {
                const band = s.score_band ? BAND_LABELS[s.score_band] : null
                const isWithdrawn = s.status === 'withdrawn'
                const isExpanded = expandedId === s.id
                const targetDate = s.confirmed_target_date ?? s.suggested_target_date
                const pending = !s.scored_at && !isWithdrawn && s.status !== 'rejected'

                return (
                  <>
                    {/* Main row */}
                    <tr
                      key={s.id}
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                      } ${isWithdrawn ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.quick_win_flag && !isWithdrawn && (
                            <span className="text-xs text-green-700 font-semibold shrink-0">⚡</span>
                          )}
                          <span className="line-clamp-2">{s.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{categoryLabel(s.category)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`bramley-badge ${statusClass(s.status)}`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {pending ? (
                          <span className="text-xs text-gray-400 italic">Pending</span>
                        ) : band && !isWithdrawn ? (
                          <span className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${s.id}-detail`} className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-3 max-w-3xl">

                            {/* Full description */}
                            <p className="text-sm text-gray-700 leading-relaxed">{s.description}</p>

                            {/* Assessment message */}
                            {s.member_msg && !isWithdrawn && (
                              <div className="bg-white rounded-[8px] border border-blue-100 p-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                  Assessment {s.scored_at ? `· ${formatDate(s.scored_at)}` : ''}
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed">{s.member_msg}</p>
                                {targetDate && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    {s.confirmed_target_date ? 'Target date' : 'Indicative timeline'}:{' '}
                                    <strong>{formatDate(targetDate)}</strong>
                                    {s.confirmed_target_date && <span className="ml-1 text-green-600 font-semibold">✓ confirmed</span>}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Pending / withdrawn / rejected states */}
                            {pending && (
                              <p className="text-xs text-gray-400 italic">Assessment pending — usually within 24 hours.</p>
                            )}
                            {isWithdrawn && (
                              <p className="text-xs text-gray-400 italic">Withdrawn {s.withdrawn_at ? formatDate(s.withdrawn_at) : ''}</p>
                            )}
                            {s.status === 'rejected' && !s.member_msg && (
                              <p className="text-xs text-gray-500 italic">Thank you for your submission. We were unable to progress this one. If you have a concern to raise directly, please contact the Club Manager.</p>
                            )}

                            {/* History */}
                            {s.history.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Status history</p>
                                <ol className="space-y-1">
                                  {s.history.map((h, hi) => (
                                    <li key={hi} className="flex items-center gap-3 text-xs text-gray-500">
                                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                      <span className="font-medium">{STATUS_LABELS[h.new_status] ?? h.new_status}</span>
                                      <span className="text-gray-400">{formatDate(h.changed_at)}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Withdraw */}
                            {!isWithdrawn && s.status !== 'implemented' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleWithdraw(s) }}
                                disabled={withdrawingId === s.id}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                {withdrawingId === s.id ? 'Withdrawing…' : 'Withdraw this idea'}
                              </button>
                            )}
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
    </div>
  )
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    new:                'status-new',
    under_consideration: 'status-under_consideration',
    approved:           'status-approved',
    implemented:        'status-implemented',
    rejected:           'status-rejected',
    in_plan:            'status-new',
    withdrawn:          'status-rejected',
  }
  return map[status] ?? 'status-new'
}
