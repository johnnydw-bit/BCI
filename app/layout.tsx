import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'Bramley GC — Continuous Improvement Programme',
  description: 'Share your improvement ideas as part of the Bramley GC Continuous Improvement Programme',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen bg-bramley-bg font-sans">
        {children}
      </body>
    </html>
  )
}
