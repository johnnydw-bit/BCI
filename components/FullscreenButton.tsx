'use client'

import { useEffect, useState } from 'react'

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggle() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <button
      onClick={toggle}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
      className="text-white opacity-60 hover:opacity-100 transition-opacity text-lg leading-none select-none"
    >
      {isFullscreen ? '⊠' : '⛶'}
    </button>
  )
}
