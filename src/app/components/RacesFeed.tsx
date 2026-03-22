'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import RaceCard from './RaceCard'
import type { RaceWithRunners } from '@/types'

interface RacesFeedProps {
  hideFormatBox?: boolean
  slipPicks: string[]
  onAddToSlip: (id: string, runner: string, odds: number, label: string, raceId: string) => void
  onRemoveFromSlip: (id: string) => void
}

export default function RacesFeed({
  hideFormatBox = false,
  slipPicks,
  onAddToSlip,
  onRemoveFromSlip,
}: RacesFeedProps) {
  const [races, setRaces] = useState<RaceWithRunners[]>([])
  const [loading, setLoading] = useState(true)
  const [userBets, setUserBets] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    fetchRaces()
    fetchUserBets()
  }, [])

  async function fetchRaces() {
    const res = await fetch('/api/races')
    const data = await res.json()
    setRaces(data ?? [])
    setLoading(false)
  }

  async function fetchUserBets() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: bets } = await supabase
      .from('bets')
      .select('race_runner_id, race_runner:race_runners(race_id)')
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (bets) {
      const map: Record<string, string> = {}
      bets.forEach((b: any) => {
        if (b.race_runner?.race_id) {
          map[b.race_runner.race_id] = b.race_runner_id
        }
      })
      setUserBets(map)
    }
  }

  function handleBetPlaced(raceRunnerId: string, raceId: string) {
    setUserBets(prev => ({ ...prev, [raceId]: raceRunnerId }))
  }

  const byWeek = races.reduce((acc, race) => {
    if (!acc[race.week]) acc[race.week] = []
    acc[race.week].push(race)
    return acc
  }, {} as Record<number, RaceWithRunners[]>)

  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b)

  if (loading) {
    return (
      <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>
        Loading races...
      </div>
    )
  }

  if (!races.length) {
    return (
      <div style={{ color: 'var(--dim)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏎</div>
        <div>No upcoming races scheduled yet.</div>
      </div>
    )
  }

  return (
    <div>
      {!hideFormatBox && (
        <div style={{
          background: 'var(--navy3)',
          border: '0.5px solid var(--borderb)',
          borderRadius: '7px',
          padding: '9px 12px',
          marginBottom: '14px',
        }}>
          <div style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--white)',
            marginBottom: '3px',
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: '.5px', textTransform: 'uppercase',
          }}>
            1v1v1 · Ladder League
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            3 runners race simultaneously — fastest time wins. Bet on who wins each race. Betting closes when the race starts.
          </div>
          <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
            {[
              { label: '🥇 1st → moves up / qualifies', bg: '#1a1608', color: 'var(--gold)', border: 'var(--gold-dim)' },
              { label: '🥈 2nd → moves up', bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'var(--blue-border)' },
              { label: '🥉 3rd → drops down', bg: 'var(--red-bg)', color: 'var(--red2)', border: 'var(--red-border)' },
            ].map(p => (
              <span key={p.label} style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '10px', background: p.bg, color: p.color,
                border: `1px solid ${p.border}`,
              }}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {weeks.map(week => {
        const weekRaces = byWeek[week]

        return (
          <div key={week} style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '10px',
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '15px', fontWeight: 800,
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>
                Week {week}
              </div>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            </div>

            {weekRaces.map(race => (
              <RaceCard
                key={race.id}
                race={race}
                userBets={userBets}
                onBetPlaced={handleBetPlaced}
                slipPicks={slipPicks}
                onAddToSlip={onAddToSlip}
                onRemoveFromSlip={onRemoveFromSlip}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}