import './globals.css'
import type { Metadata } from 'next'
import { IBConnectionProvider } from './contexts/IBConnectionContext'

export const metadata: Metadata = {
  title: 'TradingApp',
  description: 'Web-based trading platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <IBConnectionProvider>
          {children}
        </IBConnectionProvider>
      </body>
    </html>
  )
} 