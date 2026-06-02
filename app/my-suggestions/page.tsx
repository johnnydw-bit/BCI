'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, STATUS_LABELS } from '@/lib/categories'

interface Suggestion {
  id: number
  description: string
  category: string
  status: string
  member_msg: string | null
  score_band: string | null
  created_at: string
}

export default function MySuggestionsPage() {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my-suggestions')
      .then((r) => {
        if (r.status === 401) { router.push('/'); return null }
        return r.json()
      })
      .then((data) => {
        if (data) setSuggestions(data.suggestions)
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
    <div className="bramley-card">
      <div className="bramley-header">
        <h1 className="text-xl font-bold">⛳ Bramley Golf Club</h1>
        <p className="text-sm opacity-80 mt-0.5">My suggestions</p>
      </div>

      <div className="bramley-body space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>You haven&apos;t submitted any suggestions yet.</p>
          </div>
        ) : (
          suggestions.map((s) => (
            <div key={s.id} className="border border-gray-200 rounded-[10px] p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className={`bramley-badge ${statusClass(s.status)}`}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
                <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
              </div>
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{s.description}</p>
              <p className="text-xs text-gray-500">{categoryLabel(s.category)}</p>
              {s.member_msg && (
                <div className="bg-gray-50 rounded-[8px] px-3 py-2">
                  <p className="text-xs text-gray-600 italic">{s.member_msg}</p>
                </div>
              )}
            </div>
          ))
        )}

        <button onClick={() => router.push('/submit')} className="bramley-btn">
          Submit a suggestion
        </button>
        <button onClick={handleLogout} className="text-sm text-gray-400 w-full py-2 hover:text-gray-600">
          Sign out
        </button>
      </div>
    </div>
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
