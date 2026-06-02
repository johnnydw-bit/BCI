import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bramley GC — Continuous Improvement Programme',
  description: 'Share your improvement ideas as part of the Bramley GC Continuous Improvement Programme',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-start py-8 px-4">
        {children}
      </body>
    </html>
  )
}
