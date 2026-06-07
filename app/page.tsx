'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BramleyHeader from '@/components/BramleyHeader'

export default function LoginPage() {
  const router = useRouter()

  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (s.authenticated && s.type === 'member') { router.replace('/submit'); return }
      setChecking(false)
    })
  }, [router])

  async function handleMemberLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName, email: memberEmail }),
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

  if (checking) return null

  return (
    <div className="bramley-wide-page">
      <div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />

        <div className="bramley-body">
          <form onSubmit={handleMemberLogin} className="space-y-4">
            <div>
              <label className="bramley-label">Your name</label>
              <input
                className="bramley-input"
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                autoComplete="name"
                placeholder="Your full name"
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

            {error && <p className="bramley-error">{error}</p>}

            <button type="submit" className="bramley-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Continue'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Enter your name and email address to submit an improvement idea.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
