'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, IMPACT_OPTIONS } from '@/lib/categories'
import BramleyHeader from '@/components/BramleyHeader'
import InstallPrompt from '@/components/InstallPrompt'

const DESC_MAX = 200
const BENEFIT_MAX = 500

type Step = 'form' | 'submitting' | 'success' | 'rejected'

export default function SubmitPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [sessionType, setSessionType] = useState<'member' | 'director' | null>(null)

  const [sessionWarning, setSessionWarning] = useState(false)

  // Require member or director session
  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((s) => {
      if (!s.authenticated || (s.type !== 'member' && s.type !== 'director')) router.replace('/')
      else setSessionType(s.type)
    })
  }, [router])

  // Session timeout — 110 min warning, 120 min auto-logout
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (logoutRef.current) clearTimeout(logoutRef.current)
      setSessionWarning(false)
      timerRef.current   = setTimeout(() => setSessionWarning(true), 110 * 60 * 1000)
      logoutRef.current  = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/?timeout=1')
      }, 120 * 60 * 1000)
    }
    reset()
    const events = ['mousemove', 'keydown', 'click', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (logoutRef.current) clearTimeout(logoutRef.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [router])
  const [description, setDescription] = useState('')
  const [benefit, setBenefit] = useState('')
  const [category, setCategory] = useState('')
  const [impact, setImpact] = useState<number | ''>('')
  const [recognition, setRecognition] = useState('named')
  const [emailOptOut, setEmailOptOut] = useState(false)
  const [message, setMessage] = useState('')
  const [memberMsg, setMemberMsg] = useState<string | null>(null)

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
      setMessage(data.message ?? '')
      setMemberMsg(data.memberMsg ?? null)
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
      <div className="bramley-wide-page"><div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />
        <div className="bramley-body flex flex-col items-center py-12 gap-4">
          <span className="spinner" style={{ borderColor: 'var(--bramley-navy)', borderTopColor: 'transparent' }} />
          <p className="text-gray-600">Reviewing your improvement…</p>
          <p className="text-gray-400 text-sm">This may take a few seconds</p>
        </div>
      </div></div>
    )
  }

  if (step === 'success') {
    return (
      <div className="bramley-wide-page"><div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />
        <div className="bramley-body space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-[10px] p-4">
            <p className="text-green-800 font-semibold">✓ Thank you — your improvement has been received</p>
          </div>

          {memberMsg && (
            <div className="rounded-[10px] border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 text-white text-sm font-semibold" style={{ background: 'var(--bramley-primary)' }}>
                Initial thoughts
              </div>
              <div className="p-4 space-y-3">
                <p className="text-gray-800 leading-relaxed whitespace-pre-line">{memberMsg}</p>
                <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                  This is a preliminary AI assessment only. Your idea will be fully evaluated overnight — scored for feasibility, cost and member impact, and considered alongside all other current priorities before the Board reviews it.
                </p>
              </div>
            </div>
          )}

          <button onClick={() => { setStep('form'); setDescription(''); setBenefit(''); setCategory(''); setImpact(''); setMemberMsg(null) }} className="bramley-btn">
            Submit another improvement
          </button>
          {sessionType === 'director'
            ? <button onClick={() => router.push('/triage')} className="bramley-btn-secondary">Back to triage</button>
            : <button onClick={() => router.push('/my-improvements')} className="bramley-btn-secondary">View my improvements</button>
          }
          <button onClick={handleLogout} className="text-sm text-gray-400 w-full py-2 hover:text-gray-600">Sign out</button>
        </div>
      </div></div>
    )
  }

  if (step === 'rejected') {
    return (
      <div className="bramley-wide-page"><div className="bramley-card">
        <BramleyHeader subtitle="Continuous Improvement Programme" />
        <div className="bramley-body space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-4">
            <p className="text-amber-800 text-sm">{message}</p>
          </div>
          <button onClick={() => setStep('form')} className="bramley-btn">Try again</button>
        </div>
      </div></div>
    )
  }

  return (
    <div className="bramley-wide-page"><div className="bramley-card">
      <InstallPrompt />
      <BramleyHeader subtitle="Continuous Improvement Programme" />
      {sessionWarning && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-300 rounded-[8px] px-4 py-3 text-sm text-amber-800">
          ⚠️ Your session will expire in 10 minutes due to inactivity.
        </div>
      )}
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
                    className="mt-0.5 accent-[#231d45]"
                    required
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={recognition === 'named'}
                onChange={(e) => setRecognition(e.target.checked ? 'named' : 'anonymous')}
                className="mt-0.5 accent-[#231d45]"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Enter me for programme recognition if my improvement is selected
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={emailOptOut}
                onChange={(e) => setEmailOptOut(e.target.checked)}
                className="mt-0.5 accent-[#231d45]"
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
            {sessionType === 'director'
              ? <button type="button" onClick={() => router.push('/triage')} className="bramley-btn-secondary">Back to triage</button>
              : <button type="button" onClick={() => router.push('/my-improvements')} className="bramley-btn-secondary">View my improvements</button>
            }
            <button type="button" onClick={handleLogout} className="text-sm text-gray-400 w-full py-2 hover:text-gray-600">
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div></div>
  )
}
