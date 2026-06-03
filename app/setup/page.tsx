'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BramleyHeader from '@/components/BramleyHeader'

export default function SetupPage() {
  const router = useRouter()
  const [cronSecret, setCronSecret] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'form' | 'loading' | 'done' | 'error'>('form')
  const [message, setMessage] = useState('')
  const [dbStatus, setDbStatus] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/admin/bootstrap')
      .then((r) => r.json())
      .then((d) => {
        if (d.exists) router.replace('/')
      })
      .finally(() => setChecking(false))
  }, [router])

  if (checking) return null

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (pin !== confirmPin) { setMessage('PINs do not match'); return }
    if (pin.length < 4) { setMessage('PIN must be at least 4 characters'); return }

    setStep('loading')
    setMessage('')

    // Step 1: init DB
    setDbStatus('Initialising database…')
    const dbRes = await fetch('/api/admin/init-db', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    if (!dbRes.ok) {
      setMessage('Database init failed — check your CRON_SECRET')
      setStep('error')
      return
    }

    // Step 2: create Club Manager
    setDbStatus('Creating Club Manager account…')
    const bmRes = await fetch('/api/admin/bootstrap', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin, name, email }),
    })
    const data = await bmRes.json()
    if (!bmRes.ok) {
      setMessage(data.error ?? 'Bootstrap failed')
      setStep('error')
      return
    }

    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="bramley-card">
        <BramleyHeader subtitle="First-time Setup" />
        <div className="bramley-body space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-[10px] p-4">
            <p className="text-green-800 font-semibold">✓ Setup complete</p>
            <p className="text-green-700 text-sm mt-1">Club Manager account created. You can now sign in.</p>
          </div>
          <a href="/" className="bramley-btn block text-center">Go to login →</a>
          <p className="text-xs text-gray-400 text-center">
            This setup page will reject further attempts once a Club Manager exists.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bramley-card">
      <div className="bramley-header">
        <h1 className="text-xl font-bold">⛳ Bramley GC — First-time Setup</h1>
        <p className="text-sm opacity-80 mt-0.5">Run once to initialise the database and create the Club Manager account</p>
      </div>
      <div className="bramley-body">
        <form onSubmit={handleSetup} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3">
            <p className="text-amber-800 text-xs">This page requires your CRON_SECRET from Vercel environment variables. After setup it cannot be used again.</p>
          </div>

          <div>
            <label className="bramley-label">CRON Secret</label>
            <input
              className="bramley-input font-mono text-sm"
              type="password"
              value={cronSecret}
              onChange={(e) => setCronSecret(e.target.value)}
              placeholder="Paste your CRON_SECRET value"
              required
            />
          </div>

          <div>
            <label className="bramley-label">Your full name</label>
            <input className="bramley-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" required />
          </div>

          <div>
            <label className="bramley-label">Your email</label>
            <input className="bramley-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>

          <div>
            <label className="bramley-label">Choose a PIN</label>
            <input className="bramley-input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="At least 4 characters" required />
          </div>

          <div>
            <label className="bramley-label">Confirm PIN</label>
            <input className="bramley-input" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Repeat your PIN" required />
          </div>

          {message && <p className="bramley-error">{message}</p>}

          {step === 'loading' && (
            <p className="text-sm text-gray-500">{dbStatus}</p>
          )}

          <button type="submit" className="bramley-btn" disabled={step === 'loading'}>
            {step === 'loading' ? <span className="spinner" /> : 'Initialise & create account'}
          </button>

          {step === 'error' && (
            <button type="button" onClick={() => setStep('form')} className="bramley-btn-secondary">
              Try again
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
