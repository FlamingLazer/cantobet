import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CantoBet',
  description: 'Sportsbook for TCS Ladder League',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}