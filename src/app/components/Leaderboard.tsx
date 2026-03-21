'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface LeaderboardEntry {
  id: string
  twitch_username: string
  studs_balance: number
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchLeaderboard()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('users')
      .select('id, twitch_username, studs_balance')
      .order('studs_balance', { ascending: false })
      .limit(50)

    setEntries(data ?? [])
    setLoading(false)
  }

  const rankColor = (i: number) => {
    if (i === 0) return 'var(--gold)'
    if (i === 1) return '#9ea1a8'
    if (i === 2) return '#c47a3c'
    return 'var(--dim)'
  }

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading leaderboard...</div>
  }

  if (!entries.length) {
    return (
      <div style={{ color: 'var(--dim)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏅</div>
        <div>No users yet — be the first to sign in!</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 120px',
          gap: '8px',
          padding: '8px 16px',
          borderBottom: '0.5px solid var(--border)',
          fontSize: '10px', fontWeight: 700,
          color: 'var(--muted)',
          letterSpacing: '.8px',
          textTransform: 'uppercase',
          background: 'var(--navy3)',
        }}>
          <span>#</span>
          <span>Username</span>
          <span style={{ textAlign: 'right' }}>Studs</span>
        </div>

        {entries.map((entry, i) => {
          const isYou = entry.id === currentUserId
          return (
            <div
              key={entry.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 120px',
                gap: '8px',
                padding: '10px 16px',
                borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                background: isYou ? 'rgba(212,170,58,0.06)' : 'transparent',
                alignItems: 'center',
              }}
            >
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '16px', fontWeight: 800,
                color: rankColor(i),
                textAlign: 'center',
              }}>
                {i + 1}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '14px', fontWeight: 600,
                  letterSpacing: '.2px',
                }}>
                  {entry.twitch_username}
                </span>
                {isYou && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    padding: '1px 6px', borderRadius: '3px',
                    background: 'var(--blue-bg)', color: 'var(--blue)',
                    border: '1px solid var(--blue-border)',
                  }}>
                    YOU
                  </span>
                )}
                {i === 0 && (
                  <span style={{ fontSize: '14px' }}>👑</span>
                )}
              </div>

              <div style={{
                textAlign: 'right',
                fontSize: '13px', fontWeight: 600,
                color: 'var(--gold)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {entry.studs_balance.toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}