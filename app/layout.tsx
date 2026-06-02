import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bramley GC — Member Suggestions',
  description: 'Share your ideas to help improve Bramley Golf Club',
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
