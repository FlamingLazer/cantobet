'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Pick {
  id: string
  odds_at_placement: number
  points_earned: number | null
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  race_runner?: {
    odds: number
    runner?: { username: string; country_code?: string | null }
    race?: { week: number; rung: number; status: string; scheduled_at: string; stage?: string | null }
  }
}


function Flag({ code }: { code?: string | null }) {
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      alt={code}
      style={{ width: '14px', height: '10px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
    />
  )
}

export default function MyBets({ loggedIn = false }: { loggedIn?: boolean }) {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'active' | 'settled'>('active')
  const [totalPoints, setTotalPoints] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchPicks()
  }, [])

  async function fetchPicks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('bets')
      .select(`
        id, odds_at_placement, points_earned, status, placed_at,
        race_runner:race_runners(
          odds,
          runner:runners(username, country_code),
          race:races(week, rung, status, scheduled_at)
        )
      `)
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })

    const picksData = (data as unknown as Pick[]) ?? []
    setPicks(picksData)
    setTotalPoints(picksData.filter(p => p.status === 'won').reduce((sum, p) => sum + (p.points_earned ?? 0), 0))
    setLoading(false)
  }

  const activePicks = picks.filter(p => p.status === 'pending')
  const settledPicks = picks.filter(p => p.status !== 'pending')
  const correctPicks = settledPicks.filter(p => p.status === 'won').length
  const accuracy = settledPicks.length > 0
    ? Math.round((correctPicks / settledPicks.length) * 100)
    : 0


  if (!loggedIn) {
    return (
      <div style={{ color: 'var(--muted)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
        <div style={{ fontSize: '15px', color: 'var(--white)' }}>Login to Predict</div>
        <div style={{ fontSize: '13px', marginTop: '6px' }}>Sign in with Twitch to make predictions and track your picks.</div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading picks...</div>
  }

  return (
    <div>
      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px', marginBottom: '16px',
      }}>
        {[
          { val: totalPoints.toFixed(1), label: 'Total points', color: 'var(--gold)' },
          { val: `${correctPicks}/${settledPicks.length}`, label: 'Correct picks', color: 'var(--green)' },
          { val: `${accuracy}%`, label: 'Accuracy', color: 'var(--blue)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--navy2)', border: '0.5px solid var(--border)',
            borderRadius: '6px', padding: '10px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '22px', fontWeight: 800, color: s.color,
            }}>{s.val}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Section toggle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
        <button
          onClick={() => setSection('active')}
          style={{
            padding: '8px',
            borderRadius: '6px',
            border: `0.5px solid ${section === 'active' ? 'var(--red2)' : 'var(--border)'}`,
            background: section === 'active' ? 'var(--red-bg)' : 'var(--navy2)',
            color: section === 'active' ? 'var(--red2)' : 'var(--muted)',
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '13px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          Active
          {activePicks.length > 0 && (
            <span style={{
              background: 'var(--red2)', color: '#fff',
              borderRadius: '10px', fontSize: '10px',
              fontWeight: 700, padding: '1px 6px',
            }}>
              {activePicks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSection('settled')}
          style={{
            padding: '8px',
            borderRadius: '6px',
            border: `0.5px solid ${section === 'settled' ? 'var(--green-border)' : 'var(--border)'}`,
            background: section === 'settled' ? 'var(--green-bg)' : 'var(--navy2)',
            color: section === 'settled' ? 'var(--green)' : 'var(--muted)',
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '13px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          Complete
          {settledPicks.length > 0 && (
            <span style={{
              background: 'var(--green)', color: '#fff',
              borderRadius: '10px', fontSize: '10px',
              fontWeight: 700, padding: '1px 6px',
            }}>
              {settledPicks.length}
            </span>
          )}
        </button>
      </div>

      {/* Active picks */}
      {section === 'active' && (
        <>
          {activePicks.length === 0 && (
            <div style={{ color: 'var(--dim)', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎯</div>
              No active picks. Head to Races to make a prediction.
            </div>
          )}
          {activePicks.map(pick => {
            const race = pick.race_runner?.race
            const runner = pick.race_runner?.runner
            return (
              <div key={pick.id} style={{
                background: 'var(--navy2)',
                border: '0.5px solid var(--border)',
                borderRadius: '7px',
                padding: '10px 12px',
                marginBottom: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}>
                    <Flag code={runner?.country_code} />
                    {runner?.username ?? '—'} wins
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {race ? (race.stage ?? `W${race.week} · Rung ${race.rung}`) : '—'} · {pick.odds_at_placement}pts if correct
                  </div>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 800,
                  padding: '2px 8px', borderRadius: '3px',
                  background: 'var(--blue-bg)', color: 'var(--blue)',
                  border: '1px solid var(--blue-border)',
                }}>
                  PENDING
                </span>
              </div>
            )
          })}
        </>
      )}

      {/* Settled picks */}
      {section === 'settled' && (
        <>
          {settledPicks.length === 0 && (
            <div style={{ color: 'var(--dim)', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
              No complete picks yet.
            </div>
          )}
          {settledPicks.map(pick => {
            const race = pick.race_runner?.race
            const runner = pick.race_runner?.runner
            const won = pick.status === 'won'
            return (
              <div key={pick.id} style={{
                background: 'var(--navy2)',
                border: `0.5px solid ${won ? 'var(--green-border)' : 'var(--border)'}`,
                borderRadius: '7px',
                padding: '10px 12px',
                marginBottom: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}>
                    <Flag code={runner?.country_code} />
                    {runner?.username ?? '—'} wins
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {race ? (race.stage ?? `W${race.week} · Rung ${race.rung}`) : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '15px', fontWeight: 700,
                    color: won ? 'var(--green)' : 'var(--red2)',
                    fontFamily: "'Montserrat', sans-serif",
                  }}>
                    {won ? `+${(pick.points_earned ?? 0).toFixed(1)}pts` : '+0.0pts'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
                    {won ? 'Correct' : 'Incorrect'}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}

    </div>
  )
}