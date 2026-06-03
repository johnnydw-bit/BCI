'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, STATUS_LABELS } from '@/lib/categories'
import BramleyHeader from '@/components/BramleyHeader'

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
  quick_win_flag: boolean
  scored_at: string | null
  created_at: string
}

const BAND_LABELS: Record<string, { label: string; color: string }> = {
  priority:       { label: 'Priority — high likelihood of implementation', color: '#0d5d3d' },
  active:         { label: 'Active queue — under consideration',           color: '#1e8449' },
  holding:        { label: 'Holding — good idea, longer timeframe',        color: '#b7770d' },
  low_priority:   { label: 'Low priority at this time',                    color: '#888'    },
  not_progressed: { label: 'Not progressed',                               color: '#aaa'    },
  in_plan:        { label: 'Already in our improvement plan',              color: '#2471a3' },
}

export default function MyImprovementsPage() {
  const router = useRouter()
  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

            return (
              <div key={s.id} className="border border-gray-200 rounded-[10px] overflow-hidden">
                {/* Header row */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`bramley-badge ${statusClass(s.status)}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{s.description}</p>
                  <p className="text-xs text-gray-500">{categoryLabel(s.category)}</p>

                  {s.quick_win_flag && (
                    <span className="bramley-badge text-xs" style={{ background: '#1e8449' }}>⚡ Quick win</span>
                  )}
                </div>

                {/* Assessment panel */}
                {assessed ? (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessment {s.scored_at ? `· ${formatDate(s.scored_at)}` : ''}</p>

                    {band && (
                      <div className="flex items-center gap-2">
                        <span
                          className="bramley-badge text-xs shrink-0"
                          style={{ background: band.color }}
                        >
                          {band.label}
                        </span>
                      </div>
                    )}

                    {s.member_msg && (
                      <p className="text-sm text-gray-700 leading-relaxed">{s.member_msg}</p>
                    )}

                    {s.suggested_target_date && (
                      <p className="text-xs text-gray-500">
                        Indicative timeline: <strong>{formatDate(s.suggested_target_date)}</strong>
                      </p>
                    )}
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
  }
  return map[status] ?? 'status-new'
}
