'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import RaceCard from './RaceCard'
import type { RaceWithRunners } from '@/types'

interface RacesFeedProps {
  hideFormatBox?: boolean
  loggedIn?: boolean
}

export default function RacesFeed({ hideFormatBox = false, loggedIn = false }: RacesFeedProps) {
  const [races, setRaces] = useState<RaceWithRunners[]>([])
  const [loading, setLoading] = useState(true)
  const [userPicks, setUserPicks] = useState<Record<string, string>>({})
  const [ladderPbs, setLadderPbs] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    fetchRaces()
    fetchUserPicks()
    fetchLadderPbs()
  }, [])

  async function fetchRaces() {
    const res = await fetch('/api/races')
    const data = await res.json()
    setRaces(data ?? [])
    setLoading(false)
  }

  async function fetchUserPicks() {
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
      setUserPicks(map)
    }
  }

  async function fetchLadderPbs() {
    const res = await fetch('/api/ladder-pbs')
    const data = await res.json()
    setLadderPbs(data ?? {})
  }

  function handlePickPlaced(raceRunnerId: string, raceId: string) {
    setUserPicks(prev => ({ ...prev, [raceId]: raceRunnerId }))
  }

  function sectionKey(race: RaceWithRunners): string {
    if (race.stage === 'Wildcard Match') return 'Wildcard Match'
    if (race.stage) return 'Top 8 Playoffs'
    return `week_${race.week}`
  }

  function sectionLabel(key: string): string {
    if (key === 'Wildcard Match' || key === 'Top 8 Playoffs') return key
    return `Week ${key.replace('week_', '')}`
  }

  const bySection = races.reduce((acc, race) => {
    const key = sectionKey(race)
    if (!acc[key]) acc[key] = []
    acc[key].push(race)
    return acc
  }, {} as Record<string, RaceWithRunners[]>)

  // Sort: regular weeks numerically first, then Wildcard Match, then Top 8 Playoffs
  const sectionOrder = (key: string) => {
    if (key === 'Wildcard Match') return 10000
    if (key === 'Top 8 Playoffs') return 10001
    return parseInt(key.replace('week_', ''))
  }
  const sections = Object.keys(bySection).sort((a, b) => sectionOrder(a) - sectionOrder(b))

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
            fontSize: '14px', fontWeight: 700, color: 'var(--white)',
            marginBottom: '3px',
            fontFamily: "'Montserrat', sans-serif",
            letterSpacing: '.5px', textTransform: 'uppercase',
          }}>
            1v1v1 · Ladder League
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            3 runners race simultaneously — fastest time wins. Predict the winner of each race to earn points.
          </div>
        </div>
      )}

      {sections.map(key => {
        const sectionRaces = bySection[key]

        return (
          <div key={key} style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '10px',
            }}>
              <div style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '17px', fontWeight: 800,
                letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--white)',
              }}>
                {sectionLabel(key)}
              </div>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            </div>

            {sectionRaces.map(race => (
              <RaceCard
                key={race.id}
                race={race}
                userPicks={userPicks}
                onPickPlaced={handlePickPlaced}
                slipPicks={[]}
                onAddToSlip={() => {}}
                onRemoveFromSlip={() => {}}
                loggedIn={loggedIn}
                ladderPbs={ladderPbs}
              />
            ))}
          </div>
        )
      })}

    </div>
  )
}