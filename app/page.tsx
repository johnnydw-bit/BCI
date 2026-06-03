'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BramleyHeader from '@/components/BramleyHeader'

export default function LoginPage() {
  const router = useRouter()
  // Redirect if already logged in
  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (s.authenticated && s.type === 'member') router.replace('/submit')
      if (s.authenticated && s.type === 'director') router.replace('/triage')
    })
  }, [router])

  const [memberId, setMemberId] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'member' | 'director'>('member')
  const [directorPin, setDirectorPin] = useState('')

  async function handleMemberLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, pin, email: memberEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/submit')
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDirectorLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: directorPin }),
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

  return (
    <div className="bramley-page">
    <div className="bramley-card">
      <BramleyHeader subtitle="Continuous Improvement Programme" />

      <div className="bramley-body">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode('member'); setError('') }}
            className={`flex-1 py-2 rounded-[10px] text-sm font-semibold transition-all ${mode === 'member' ? 'text-white' : 'border border-gray-300 text-gray-600'}`}
            style={mode === 'member' ? { background: 'var(--bramley-navy)' } : {}}
          >
            Member Login
          </button>
          <button
            onClick={() => { setMode('director'); setError('') }}
            className={`flex-1 py-2 rounded-[10px] text-sm font-semibold transition-all ${mode === 'director' ? 'text-white' : 'border border-gray-300 text-gray-600'}`}
            style={mode === 'director' ? { background: 'var(--bramley-navy)' } : {}}
          >
            Committee Access
          </button>
        </div>

        {mode === 'member' ? (
          <form onSubmit={handleMemberLogin} className="space-y-4">
            <div>
              <label className="bramley-label">Member ID</label>
              <input
                className="bramley-input"
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                autoComplete="username"
                placeholder="Your membership number"
                required
              />
            </div>
            <div>
              <label className="bramley-label">Email address</label>
              <input
                className="bramley-input"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                autoComplete="email"
                placeholder="Your email address"
                required
              />
            </div>
            <div>
              <label className="bramley-label">PIN</label>
              <div className="relative">
                <input
                  className="bramley-input pr-12"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Your website PIN"
                  required
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
              Use your Bramley GC membership number, registered email address and website PIN.
            </p>
          </form>
        ) : (
          <form onSubmit={handleDirectorLogin} className="space-y-4">
            <div>
              <label className="bramley-label">Committee PIN</label>
              <div className="relative">
                <input
                  className="bramley-input pr-12"
                  type={showPin ? 'text' : 'password'}
                  value={directorPin}
                  onChange={(e) => setDirectorPin(e.target.value)}
                  placeholder="Enter your committee PIN"
                  required
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
              {loading ? <span className="spinner" /> : 'Access Triage Report'}
            </button>
          </form>
        )}
      </div>
    </div>
    </div>
  )
}
