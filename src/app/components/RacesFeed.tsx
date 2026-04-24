'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import RaceCard from './RaceCard'
import type { RaceWithRunners } from '@/types'

interface RacesFeedProps {
  loggedIn?: boolean
}

export default function RacesFeed({ loggedIn = false }: RacesFeedProps) {
  const [races, setRaces] = useState<RaceWithRunners[]>([])
  const [loading, setLoading] = useState(true)
  const [userPicks, setUserPicks] = useState<Record<string, string>>({})
  const [ladderPbs, setLadderPbs] = useState<Record<string, string>>({})
  const [pendingSelections, setPendingSelections] = useState<Record<string, string>>({})
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [confirmAllError, setConfirmAllError] = useState<string | null>(null)
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

  function handleSelect(raceId: string, raceRunnerId: string | null) {
    setPendingSelections(prev => {
      const next = { ...prev }
      if (raceRunnerId === null) {
        delete next[raceId]
      } else {
        next[raceId] = raceRunnerId
      }
      return next
    })
  }

  async function confirmAll() {
    const entries = Object.entries(pendingSelections)
    if (!entries.length) return
    setConfirmingAll(true)
    setConfirmAllError(null)

    let failed = 0
    for (const [raceId, raceRunnerId] of entries) {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_runner_id: raceRunnerId }),
      })
      if (res.ok) {
        handlePickPlaced(raceRunnerId, raceId)
      } else {
        failed++
      }
    }

    setPendingSelections({})
    setConfirmingAll(false)
    if (failed > 0) setConfirmAllError(`${failed} pick${failed > 1 ? 's' : ''} failed to save`)
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

  const sectionOrder = (key: string) => {
    if (key === 'Wildcard Match') return 10000
    if (key === 'Top 8 Playoffs') return 10001
    return parseInt(key.replace('week_', ''))
  }
  const sections = Object.keys(bySection).sort((a, b) => sectionOrder(a) - sectionOrder(b))

  const pendingCount = Object.keys(pendingSelections).length

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
    <div style={{ paddingBottom: pendingCount > 0 ? '80px' : '0' }}>
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
                ladderPbs={key === 'week_1' ? {} : ladderPbs}
                selectedRR={pendingSelections[race.id] ?? null}
                onSelect={(id) => handleSelect(race.id, id)}
              />
            ))}
          </div>
        )
      })}

      {/* Sticky Confirm All bar */}
      {pendingCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(8,11,16,0.97)',
          borderTop: '0.5px solid var(--borderb)',
          backdropFilter: 'blur(12px)',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '10px',
          zIndex: 40,
        }}>
          {confirmAllError && (
            <span style={{ fontSize: '12px', color: 'var(--red2)' }}>{confirmAllError}</span>
          )}
          <button
            onClick={() => { setPendingSelections({}); setConfirmAllError(null) }}
            style={{
              padding: '9px 16px',
              background: 'transparent', color: 'var(--muted)',
              border: '0.5px solid var(--border)', borderRadius: '6px',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={confirmAll}
            disabled={confirmingAll}
            style={{
              padding: '9px 24px',
              background: confirmingAll ? 'var(--navy4)' : 'var(--accent)',
              color: 'var(--bg)', border: 'none',
              fontFamily: "'Rubik', sans-serif",
              fontSize: '15px', fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase',
              cursor: confirmingAll ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
              transition: 'background .2s',
            }}
          >
            {confirmingAll ? 'Confirming...' : pendingCount === 1 ? 'Confirm' : `Confirm All (${pendingCount})`}
          </button>
        </div>
      )}
    </div>
  )
}
