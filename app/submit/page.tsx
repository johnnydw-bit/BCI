'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, IMPACT_OPTIONS, RECOGNITION_OPTIONS } from '@/lib/categories'
import BramleyHeader from '@/components/BramleyHeader'

const DESC_MAX = 200
const BENEFIT_MAX = 500

type Step = 'form' | 'submitting' | 'success' | 'rejected'

export default function SubmitPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')

  // Redirect directors to triage, unauthenticated users to login
  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (!s.authenticated) router.replace('/')
      if (s.type === 'director') router.replace('/triage')
    })
  }, [router])
  const [description, setDescription] = useState('')
  const [benefit, setBenefit] = useState('')
  const [category, setCategory] = useState('')
  const [impact, setImpact] = useState<number | ''>('')
  const [recognition, setRecognition] = useState('named')
  const [emailOptOut, setEmailOptOut] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStep('submitting')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, benefit, category, impact: Number(impact), recognition, emailOptOut }),
      })
      if (res.status === 401) { router.push('/'); return }
      const data = await res.json()
      setMessage(data.message)
      setStep(data.rejected ? 'rejected' : 'success')
    } catch {
      setMessage('Something went wrong. Please try again.')
      setStep('rejected')
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (step === 'submitting') {
    return (
      <div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />
        <div className="bramley-body flex flex-col items-center py-12 gap-4">
          <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
          <p className="text-gray-600">Reviewing your improvement…</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />
        <div className="bramley-body space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-[10px] p-4">
            <p className="text-green-800 font-semibold text-sm">✓ Improvement received</p>
            <p className="text-green-700 text-sm mt-1">{message}</p>
          </div>
          <button onClick={() => { setStep('form'); setDescription(''); setBenefit(''); setCategory(''); setImpact('') }} className="bramley-btn">
            Submit another improvement
          </button>
          <button onClick={() => router.push('/my-improvements')} className="bramley-btn-secondary">
            View my improvements
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-400 w-full py-2 hover:text-gray-600">Sign out</button>
        </div>
      </div>
    )
  }

  if (step === 'rejected') {
    return (
      <div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />
        <div className="bramley-body space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-4">
            <p className="text-amber-800 text-sm">{message}</p>
          </div>
          <button onClick={() => setStep('form')} className="bramley-btn">Try again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bramley-card">
      <div className="bramley-header">
        <h1 className="text-xl font-bold">⛳ Bramley GC</h1>
        <p className="text-sm opacity-80 mt-0.5">Continuous Improvement Programme</p>
      </div>
      <div className="bramley-body">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="bramley-label mb-0">Describe your improvement <span className="text-red-500">*</span></label>
              <span className={`text-xs ${description.length > DESC_MAX ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              className="bramley-input resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What would you like to see improved at Bramley?"
              maxLength={DESC_MAX}
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="bramley-label mb-0">Why does this matter? <span className="text-red-500">*</span></label>
              <span className={`text-xs ${benefit.length > BENEFIT_MAX ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {benefit.length}/{BENEFIT_MAX}
              </span>
            </div>
            <textarea
              className="bramley-input resize-none"
              rows={4}
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              placeholder="What benefit would this bring to members? Please be as specific as you can."
              maxLength={BENEFIT_MAX}
              required
            />
          </div>

          <div>
            <label className="bramley-label">Category <span className="text-red-500">*</span></label>
            <select className="bramley-input" value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="">Select a category…</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="bramley-label">Who does this affect? <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              {IMPACT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="impact"
                    value={opt.value}
                    checked={impact === opt.value}
                    onChange={() => setImpact(opt.value)}
                    className="mt-0.5 accent-[#1a3a5c]"
                    required
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="bramley-label">Recognition preference <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              {RECOGNITION_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="recognition"
                    value={opt.value}
                    checked={recognition === opt.value}
                    onChange={() => setRecognition(opt.value)}
                    className="mt-0.5 accent-[#1a3a5c]"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Your membership details are always recorded securely for programme administration.</p>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={emailOptOut}
                onChange={(e) => setEmailOptOut(e.target.checked)}
                className="mt-0.5 accent-[#1a3a5c]"
              />
              <span className="text-sm text-gray-600 group-hover:text-gray-900">
                Don&apos;t email me when this improvement is assessed — I&apos;ll check back here instead
              </span>
            </label>
          </div>

          <div className="pt-2 space-y-3">
            <button type="submit" disabled={description.length > DESC_MAX || benefit.length > BENEFIT_MAX} className="bramley-btn">
              Submit improvement
            </button>
            <button type="button" onClick={() => router.push('/my-improvements')} className="bramley-btn-secondary">
              View my improvements
            </button>
            <button type="button" onClick={handleLogout} className="text-sm text-gray-400 w-full py-2 hover:text-gray-600">
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
