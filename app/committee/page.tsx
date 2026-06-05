'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BramleyHeader from '@/components/BramleyHeader'

export default function CommitteeLoginPage() {
  const router = useRouter()

  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (s.authenticated && s.type === 'director') { router.replace('/triage'); return }
      setChecking(false)
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/triage')
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="bramley-wide-page">
      <div className="bramley-card">
        <BramleyHeader subtitle="Committee Access" />

        <div className="bramley-body">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="bramley-label">Committee PIN</label>
              <div className="relative">
                <input
                  className="bramley-input pr-12"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your committee PIN"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPin ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <p className="bramley-error">{error}</p>}

            <button type="submit" className="bramley-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Forgotten your PIN? Contact the Club Manager or Super Admin to have it reset.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
