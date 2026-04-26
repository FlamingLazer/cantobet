'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface LeaderboardEntry {
  id: string
  twitch_username: string
  points: number
}

interface UserHistory {
  id: string
  odds_at_placement: number
  points_earned: number | null
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  race_runner?: {
    runner?: { username: string; country_code?: string | null }
    race?: { week: number; rung: number; stage?: string | null }
  }
}

interface FuturesPick {
  id: string
  runner_id: string
  direction: 'over' | 'under'
  is_correct: boolean | null
  points_earned: number | null
  line?: {
    line: number
    final_position: number | null
    settled_at: string | null
    runner?: { username: string }
  } | null
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

function UserHistoryModal({
  userId,
  username,
  onClose,
}: {
  userId: string
  username: string
  onClose: () => void
}) {
  const [history, setHistory] = useState<UserHistory[]>([])
  const [futurePicks, setFuturePicks] = useState<FuturesPick[]>([])
  const [stats, setStats] = useState<{ race_points: number; futures_points: number; futures_correct: number; futures_settled: number; futures_total: number; futures_locked: boolean; futures_visible: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllRace, setShowAllRace] = useState(false)
  const [showAllFutures, setShowAllFutures] = useState(false)
  const COLLAPSED = 5

  useEffect(() => {
    fetch(`/api/users/${userId}/profile`)
      .then(r => r.json())
      .then(d => {
        const settled = (d.bets ?? []).filter((b: UserHistory) => b.status !== 'pending')
        setHistory(settled)
        setFuturePicks(d.futures_picks ?? [])
        setStats(d.stats)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId])

  const correct = history.filter(h => h.status === 'won').length
  const racePts = stats?.race_points ?? 0
  const futuresPts = stats?.futures_points ?? 0
  const futuresLocked = stats?.futures_locked ?? false
  const futuresVisible = stats?.futures_visible ?? false
  const futuresCorrect = stats?.futures_correct ?? 0
  const futuresTotal = stats?.futures_total ?? 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,12,20,0.85)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 12px 12px',
      }}
    >
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--borderb)',
        borderRadius: '10px',
        width: '480px',
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          background: 'var(--navy3)',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '18px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {username}
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted)' }}>
              Prediction History
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', cursor: 'pointer' }}
          >✕</button>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--dim)' }}>Loading...</div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {[
                  { val: racePts.toFixed(1), label: 'Race pts', color: 'var(--gold)' },
                  { val: futuresVisible ? futuresPts.toFixed(1) : '—', label: 'Futures pts', color: 'var(--gold)' },
                  { val: `${correct}/${history.length}`, label: 'Race picks', color: 'var(--green)' },
                  { val: futuresVisible ? `${futuresCorrect}/${stats?.futures_settled ?? 0}` : '—', label: 'Futures picks', color: 'var(--green)' },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: 'var(--navy3)', border: '0.5px solid var(--border)',
                    borderRadius: '6px', padding: '9px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '18px', fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Race history */}
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', margin: '12px 0 6px' }}>
                Race Picks
              </div>
              {history.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--dim)', padding: '16px', fontSize: '12px' }}>
                  No settled predictions yet.
                </div>
              )}
              {(showAllRace ? history : history.slice(0, COLLAPSED)).map(h => {
                const won = h.status === 'won'
                const race = h.race_runner?.race
                const runner = h.race_runner?.runner
                return (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 0', borderBottom: '0.5px solid var(--border)', fontSize: '12px',
                  }}>
                    <div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flag code={runner?.country_code} />
                        {runner?.username ?? '—'} wins
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                        {race ? (race.stage ?? `W${race.week} · Rung ${race.rung}`) : '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: won ? 'var(--green)' : 'var(--red2)' }}>
                        {won ? `+${(h.points_earned ?? 0).toFixed(1)}pts` : '+0.0pts'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--dim)' }}>{won ? 'correct' : 'incorrect'}</div>
                    </div>
                  </div>
                )
              })}
              {history.length > COLLAPSED && (
                <button onClick={() => setShowAllRace(s => !s)} style={{ width: '100%', marginTop: '6px', padding: '5px', background: 'none', border: '0.5px solid var(--border)', borderRadius: '5px', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer' }}>
                  {showAllRace ? 'Show less' : `Show ${history.length - COLLAPSED} more`}
                </button>
              )}

              {/* Futures picks */}
              {futuresVisible && futurePicks.length > 0 && (
                <>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', margin: '14px 0 6px' }}>
                    Ladder Futures
                  </div>
                  {(showAllFutures ? futurePicks : futurePicks.slice(0, COLLAPSED)).map(fp => {
                    const won = fp.is_correct === true
                    const lost = fp.is_correct === false
                    return (
                      <div key={fp.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 0', borderBottom: '0.5px solid var(--border)', fontSize: '12px',
                      }}>
                        <div>
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {fp.line?.runner?.username ?? '—'}
                            <span style={{
                              fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px',
                              background: fp.direction === 'over' ? 'var(--blue-bg)' : 'var(--orange-bg)',
                              color: fp.direction === 'over' ? 'var(--blue)' : 'var(--orange)',
                              border: `1px solid ${fp.direction === 'over' ? 'var(--blue-border)' : 'var(--orange-border)'}`,
                            }}>
                              {fp.direction.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                            O/U {fp.line?.line}
                            {fp.line?.final_position && <span style={{ marginLeft: '4px' }}>· finished {fp.line.final_position}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {!fp.line?.settled_at && (
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '3px', background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }}>
                              PENDING
                            </span>
                          )}
                          {won && <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>+{(fp.points_earned ?? 0).toFixed(1)}pts</div>}
                          {lost && <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red2)' }}>+0.0pts</div>}
                        </div>
                      </div>
                    )
                  })}
                  {futurePicks.length > COLLAPSED && (
                    <button onClick={() => setShowAllFutures(s => !s)} style={{ width: '100%', marginTop: '6px', padding: '5px', background: 'none', border: '0.5px solid var(--border)', borderRadius: '5px', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer' }}>
                      {showAllFutures ? 'Show less' : `Show ${futurePicks.length - COLLAPSED} more`}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<{ id: string; username: string } | null>(null)
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
      .select('id, twitch_username, points')
      .order('points', { ascending: false })
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
        <div>No predictions yet — be the first!</div>
      </div>
    )
  }

  return (
    <>
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px',
          gap: '8px',
          padding: '8px 16px',
          borderBottom: '0.5px solid var(--border)',
          fontSize: '10px', fontWeight: 700,
          color: 'var(--muted)',
          letterSpacing: '.8px',
          textTransform: 'uppercase',
          background: 'var(--navy3)',
        }}>
          <span style={{ textAlign: 'center' }}>#</span>
          <span>Username</span>
          <span style={{ textAlign: 'right' }}>Points</span>
        </div>

        {entries.map((entry, i) => {
          const isYou = entry.id === currentUserId
          return (
            <div
              key={entry.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 80px',
                gap: '8px',
                padding: '10px 16px',
                borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                background: isYou ? 'rgba(212,170,58,0.06)' : 'transparent',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background .12s',
              }}
              onClick={() => setViewingUser({ id: entry.id, username: entry.twitch_username })}
              onMouseEnter={e => {
                if (!isYou) (e.currentTarget as HTMLDivElement).style.background = 'var(--navy3)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = isYou ? 'rgba(212,170,58,0.06)' : 'transparent'
              }}
            >
              <div style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '16px', fontWeight: 800,
                color: rankColor(i),
                textAlign: 'center',
              }}>
                {i + 1}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '14px', fontWeight: 600,
                  letterSpacing: '.2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
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
                {i === 0 && <span style={{ fontSize: '14px' }}>👑</span>}
              </div>

              <div style={{
                textAlign: 'right',
                fontSize: '13px', fontWeight: 600,
                color: 'var(--gold)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {(entry.points ?? 0).toFixed(1)}
              </div>
            </div>
          )
        })}
      </div>

      {viewingUser && (
        <UserHistoryModal
          userId={viewingUser.id}
          username={viewingUser.username}
          onClose={() => setViewingUser(null)}
        />
      )}
    </>
  )
}