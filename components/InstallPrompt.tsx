'use client'

import { useEffect, useState } from 'react'

type Platform = 'ios' | 'android-chrome' | 'desktop-chrome' | 'other'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua)
  const isMobile = /android/i.test(ua)
  if (isIOS) return 'ios'
  if (isChrome && isMobile) return 'android-chrome'
  if (isChrome) return 'desktop-chrome'
  return 'other'
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

const STORAGE_KEY = 'bci_install_dismissed'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isStandalone()) return
    if (localStorage.getItem(STORAGE_KEY)) return

    const p = detectPlatform()
    setPlatform(p)

    if (p === 'ios') {
      // Show instructions banner after a short delay
      const t = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(t)
    }

    if (p === 'android-chrome' || p === 'desktop-chrome') {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as Event & { prompt: () => Promise<void> })
        setTimeout(() => setShow(true), 2000)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    dismiss()
    setInstalling(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-lg mx-auto bg-white rounded-[12px] shadow-xl border border-gray-200 p-4">
        {platform === 'ios' ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">📲 Install the Bramley CIP app</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tap the <strong>Share</strong> button <span className="inline-block">⬆</span> at the bottom of your screen, then choose <strong>Add to Home Screen</strong>.
            </p>
            <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Not now</button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">📲 Install the Bramley CIP app</p>
              <p className="text-xs text-gray-500 mt-0.5">Add to your home screen for quick access — no browser needed.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={install}
                disabled={installing}
                className="bramley-btn text-sm px-4 py-2"
                style={{ width: 'auto' }}
              >
                {installing ? 'Installing…' : 'Install'}
              </button>
              <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600">Not now</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
