import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ladder League Predictions',
  description: 'Predictions Page for TCS Ladder League',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@700&family=Montserrat:wght@400;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}