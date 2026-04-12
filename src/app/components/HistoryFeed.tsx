'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface RaceResult {
  id: string
  week: number
  rung: number
  scheduled_at: string
  winner_runner_id: string | null
  race_runners: {
    id: string
    finish_position: number | null
    finish_time: string | null
    leapfrog: boolean
    leapfrogged: boolean
    runner: {
      username: string
      character: string
      country_code?: string | null
    } | null
  }[]
}

interface UserBetResult {
  race_runner_id: string
  status: 'pending' | 'won' | 'lost'
  wager: number
  potential_payout: number
  points_earned: number | null
  race_runner: { race_id: string } | null
}

const rungColors: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: 'var(--red)',   color: '#fff',    border: 'var(--red)' },
  2: { bg: 'var(--navy4)', color: '#8ab0f0', border: '#3d4a80' },
  3: { bg: 'var(--navy3)', color: '#6a80b0', border: 'var(--borderb)' },
  4: { bg: 'var(--navy2)', color: '#5a6890', border: 'var(--border)' },
  5: { bg: 'var(--navy2)', color: '#4a5878', border: 'var(--border)' },
  6: { bg: 'var(--navy2)', color: '#3d4868', border: 'var(--border)' },
  7: { bg: 'var(--navy2)', color: '#323860', border: 'var(--border)' },
}

function Flag({ code }: { code?: string | null }) {
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      alt={code}
      style={{
        width: '16px', height: '12px',
        objectFit: 'cover', borderRadius: '2px',
        flexShrink: 0,
      }}
    />
  )
}

function RaceDoneCard({
  race,
  userBets,
}: {
  race: RaceResult
  userBets: UserBetResult[]
}) {
  const [open, setOpen] = useState(false)
  const rungStyle = rungColors[race.rung] ?? rungColors[7]

  const sorted = [...race.race_runners].sort((a, b) =>
    (a.finish_position ?? 99) - (b.finish_position ?? 99)
  )
  const winner = sorted[0]
  const userBet = userBets.find(b => b.race_runner?.race_id === race.id)

  const rung1Note = race.rung === 1
  const eliminationRung = 8 - race.week
  const isElimRung = race.rung === eliminationRung

  return (
    <div style={{
      background: 'var(--navy2)',
      border: '0.5px solid var(--border)',
      borderRadius: '8px',
      marginBottom: '6px',
      overflow: 'hidden',
      opacity: 0.9,
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'background .12s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--navy3)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
      >
        <span style={{
          fontSize: '10px', fontWeight: 800,
          padding: '2px 8px', borderRadius: '3px',
          letterSpacing: '.8px',
          fontFamily: "'Montserrat', sans-serif",
          background: rungStyle.bg,
          color: rungStyle.color,
          border: `1px solid ${rungStyle.border}`,
          flexShrink: 0,
        }}>
          RUNG {race.rung}
        </span>

        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '5px', flex: 1,
        }}>
          <span style={{ fontSize: '12px' }}>🏆</span>
          <Flag code={winner?.runner?.country_code} />
          <span style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '14px', fontWeight: 800,
            color: 'var(--gold)', letterSpacing: '.3px',
          }}>
            {winner?.runner?.username ?? '—'}
          </span>
          <span style={{
            fontSize: '11px', color: 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {winner?.finish_time?.toString().slice(0, 8)}
          </span>
        </div>

        {rung1Note && (
          <span style={{
            fontSize: '9px', fontWeight: 700,
            padding: '1px 6px', borderRadius: '3px',
            background: '#1a1208', color: 'var(--gold)',
            border: '1px solid var(--gold-dim)',
            flexShrink: 0,
          }}>QUALIFIED</span>
        )}
        {isElimRung && !rung1Note && (
          <span style={{
            fontSize: '9px', fontWeight: 700,
            padding: '1px 6px', borderRadius: '3px',
            background: 'var(--red-bg)', color: 'var(--red2)',
            border: '1px solid var(--red-border)',
            flexShrink: 0,
          }}>2 ELIMINATED</span>
        )}
        {!rung1Note && !isElimRung && (
          <span style={{
            fontSize: '9px', fontWeight: 700,
            padding: '1px 6px', borderRadius: '3px',
            background: 'var(--green-bg)', color: 'var(--green)',
            border: '1px solid var(--green-border)',
            flexShrink: 0,
          }}>DONE</span>
        )}

        {userBet && (
          <span style={{
            fontSize: '9px', fontWeight: 700,
            padding: '1px 6px', borderRadius: '3px',
            background: userBet.status === 'won' ? 'var(--green-bg)' : userBet.status === 'lost' ? 'var(--red-bg)' : 'var(--navy4)',
            color: userBet.status === 'won' ? 'var(--green)' : userBet.status === 'lost' ? 'var(--red2)' : 'var(--muted)',
            border: `1px solid ${userBet.status === 'won' ? 'var(--green-border)' : userBet.status === 'lost' ? 'var(--red-border)' : 'var(--border)'}`,
            flexShrink: 0,
          }}>
            {userBet.status === 'won' ? `+${(userBet.points_earned ?? 0).toFixed(1)}pts` : userBet.status === 'lost' ? '✕' : '•'}
          </span>
        )}

        <span style={{
          fontSize: '10px', color: 'var(--dim)',
          transition: 'transform .2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>▼</span>
      </div>

      {open && (
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '8px 12px' }}>
          {sorted.map((rr, i) => {
            const posColor = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--blue)' : 'var(--red2)'

            const isStaying = i === 1 && rung1Note
            const isEliminated = (i === 2 && isElimRung) || (i === 1 && isElimRung)
            const isQualifying = i === 0 && rung1Note
            const isLeapfrog = rr.leapfrog === true
            const isLeapfrogged = rr.leapfrogged === true

            const badge = isQualifying ? 'QUALIFIES'
              : isLeapfrog ? '⚡ LEAPFROG'
              : isLeapfrogged ? '↔ LEAPFROGGED'
              : isStaying ? '— STAYS'
              : i === 0 ? '↑ MOVES UP'
              : isEliminated ? 'ELIMINATED'
              : i === 1 ? '↑ MOVES UP'
              : '↓ DROPS'

            const badgeBg = isQualifying ? '#1a1208'
              : isLeapfrog ? '#0d1428'
              : isLeapfrogged ? '#160d28'
              : isEliminated ? 'var(--red-bg)'
              : isStaying ? 'var(--navy4)'
              : i === 2 ? 'var(--red-bg)'
              : 'var(--green-bg)'

            const badgeColor = isQualifying ? 'var(--gold)'
              : isLeapfrog ? '#4a9eff'
              : isLeapfrogged ? '#9b6dff'
              : isEliminated ? 'var(--red2)'
              : isStaying ? 'var(--muted)'
              : i === 2 ? 'var(--red2)'
              : 'var(--green)'

            const badgeBorder = isQualifying ? 'var(--gold-dim)'
              : isLeapfrog ? '#1e3a6a'
              : isLeapfrogged ? '#3d1a6a'
              : isEliminated ? 'var(--red-border)'
              : isStaying ? 'var(--border)'
              : i === 2 ? 'var(--red-border)'
              : 'var(--green-border)'

            return (
              <div key={rr.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '3px 0',
              }}>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '14px', fontWeight: 800,
                  color: posColor, width: '14px', textAlign: 'center',
                }}>
                  {rr.finish_position}
                </div>
                <div style={{
                  fontSize: '12px', flex: 1,
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600, letterSpacing: '.2px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <Flag code={rr.runner?.country_code} />
                  {rr.runner?.username}
                </div>
                <div style={{
                  fontSize: '11px', color: 'var(--muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {rr.finish_time?.toString().slice(0, 8)}
                </div>
                <span style={{
                  fontSize: '9px', fontWeight: 700,
                  padding: '1px 5px', borderRadius: '3px',
                  background: badgeBg, color: badgeColor,
                  border: `1px solid ${badgeBorder}`,
                }}>
                  {badge}
                </span>
              </div>
            )
          })}

          {userBet && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px', paddingTop: '8px',
              borderTop: '0.5px solid var(--border)',
              fontSize: '11px',
            }}>
              <span style={{ color: 'var(--muted)' }}>
                Your prediction: <strong style={{ color: 'var(--white)' }}>
                  {race.race_runners.find(r => r.id === userBet.race_runner_id)?.runner?.username} wins
                </strong>
              </span>
              {userBet.status === 'won' && (
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                  Correct · +{(userBet.points_earned ?? 0).toFixed(1)}pts
                </span>
              )}
              {userBet.status === 'lost' && (
                <span style={{ color: 'var(--red2)', fontWeight: 700 }}>
                  Incorrect
                </span>
              )}
              {userBet.status === 'pending' && (
                <span style={{ color: 'var(--muted)' }}>Pending</span>
              )}
            </div>
          )}
          {!userBet && (
            <div style={{
              marginTop: '8px', paddingTop: '8px',
              borderTop: '0.5px solid var(--border)',
              fontSize: '11px', color: 'var(--dim)',
            }}>
              No prediction made
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoryFeed() {
  const [races, setRaces] = useState<RaceResult[]>([])
  const [userBets, setUserBets] = useState<UserBetResult[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
    fetchUserBets()
  }, [])

  async function fetchHistory() {
    const { data } = await supabase
      .from('races')
      .select(`
        id, week, rung, scheduled_at, winner_runner_id,
        race_runners (
          id, finish_position, finish_time, leapfrog, leapfrogged,
          runner:runners(username, character, country_code)
        )
      `)
      .eq('status', 'settled')
      .order('week', { ascending: false })
      .order('rung', { ascending: true })

    const raceData = (data as unknown as RaceResult[]) ?? []
    setRaces(raceData)

    if (raceData.length > 0) {
      setCurrentWeek(raceData[0].week)
    }

    setLoading(false)
  }

  async function fetchUserBets() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('bets')
      .select('race_runner_id, status, wager, potential_payout, points_earned, race_runner:race_runners(race_id)')
      .eq('user_id', user.id)

    setUserBets((data as unknown as UserBetResult[]) ?? [])
  }

  const weeks = [...new Set(races.map(r => r.week))].sort((a, b) => a - b)
  const minWeek = weeks[0] ?? 1
  const maxWeek = weeks[weeks.length - 1] ?? 1
  const weekRaces = races.filter(r => r.week === currentWeek)

  if (loading) {
    return (
      <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>
        Loading history...
      </div>
    )
  }

  if (!races.length) {
    return (
      <div style={{ color: 'var(--dim)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>📋</div>
        <div>No completed races yet.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Week navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
        background: 'var(--navy2)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        padding: '10px 14px',
      }}>
        <button
          onClick={() => setCurrentWeek(w => Math.max(minWeek, (w ?? minWeek) - 1))}
          disabled={currentWeek === minWeek}
          style={{
            background: 'none', border: 'none',
            color: currentWeek === minWeek ? 'var(--dim)' : 'var(--white)',
            fontSize: '20px', cursor: currentWeek === minWeek ? 'not-allowed' : 'pointer',
            padding: '0 8px', lineHeight: 1,
          }}
        >
          ‹
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '18px', fontWeight: 800,
            letterSpacing: '1px', textTransform: 'uppercase',
          }}>
            Week {currentWeek}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
           {weekRaces.length} race{weekRaces.length !== 1 ? 's' : ''}
          </div>
        </div>

        <button
          onClick={() => setCurrentWeek(w => Math.min(maxWeek, (w ?? maxWeek) + 1))}
          disabled={currentWeek === maxWeek}
          style={{
            background: 'none', border: 'none',
            color: currentWeek === maxWeek ? 'var(--dim)' : 'var(--white)',
            fontSize: '20px', cursor: currentWeek === maxWeek ? 'not-allowed' : 'pointer',
            padding: '0 8px', lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Week dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '6px',
        marginBottom: '14px',
      }}>
        {weeks.map(w => (
          <button
            key={w}
            onClick={() => setCurrentWeek(w)}
            style={{
              width: w === currentWeek ? '20px' : '8px',
              height: '8px',
              borderRadius: '4px',
              border: 'none',
              background: w === currentWeek ? 'var(--red2)' : 'var(--border)',
              cursor: 'pointer',
              transition: 'all .2s',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Races for current week */}
      {weekRaces.length === 0 && (
        <div style={{ color: 'var(--dim)', textAlign: 'center', padding: '30px', fontSize: '12px' }}>
          No settled races for this week yet.
        </div>
      )}

      {weekRaces.map(race => (
        <RaceDoneCard
          key={race.id}
          race={race}
          userBets={userBets}
        />
      ))}
    </div>
  )
}