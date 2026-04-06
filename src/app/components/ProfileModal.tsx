'use client'

import { useState, useEffect } from 'react'

interface Pick {
  id: string
  odds_at_placement: number
  points_earned: number | null
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  race_runner?: {
    runner?: { username: string; country_code?: string | null }
    race?: { week: number; rung: number; status: string }
  }
}

interface WatchSession {
  id: string
  started_at: string
  studs_credited: number
}

interface ProfileData {
  stats: {
    points: number
    total_correct: number
    total_predictions: number
    accuracy: number
  }
  bets: Pick[]
  watch_sessions: WatchSession[]
}

interface ProfileModalProps {
  userId: string
  username: string
  isAdmin: boolean
  onClose: () => void
  onSignOut: () => void
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

export default function ProfileModal({
  userId,
  username,
  isAdmin,
  onClose,
  onSignOut,
}: ProfileModalProps) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${userId}/profile`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  const picks = data?.bets ?? []
  const settledPicks = picks.filter(p => p.status !== 'pending')
  const correctPicks = settledPicks.filter(p => p.status === 'won')
  const totalPoints = correctPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const accuracy = settledPicks.length > 0
    ? Math.round((correctPicks.length / settledPicks.length) * 100)
    : 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,12,20,0.85)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '60px 12px 12px',
      }}
    >
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--borderb)',
        borderRadius: '10px',
        width: '500px',
        maxHeight: 'calc(100vh - 80px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideDown 0.18s ease',
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
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--green)' }} />
              {username}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted)' }}>
              {isAdmin ? 'Admin · My Account' : 'My Account'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', cursor: 'pointer' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>Loading...</div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {[
                  { val: totalPoints.toFixed(1), label: 'Total points', color: 'var(--gold)' },
                  { val: `${correctPicks.length}/${settledPicks.length}`, label: 'Correct picks', color: 'var(--green)' },
                  { val: `${accuracy}%`, label: 'Accuracy', color: 'var(--blue)' },
                  { val: picks.filter(p => p.status === 'pending').length.toString(), label: 'Pending', color: 'var(--muted)' },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: 'var(--navy3)', border: '0.5px solid var(--border)',
                    borderRadius: '6px', padding: '9px 10px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '3px', letterSpacing: '.5px', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Prediction History */}
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', margin: '12px 0 6px' }}>
                Prediction History
              </div>
              <div style={{ background: 'var(--navy2)', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ padding: '8px 12px' }}>
                  {picks.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--dim)', fontSize: '12px' }}>No predictions yet</div>
                  ) : (
                    picks.map(pick => {
                      const race = pick.race_runner?.race
                      const runner = pick.race_runner?.runner
                      const won = pick.status === 'won'
                      const lost = pick.status === 'lost'
                      const pillBg = won ? 'var(--green-bg)' : lost ? 'var(--red-bg)' : 'var(--navy4)'
                      const pillColor = won ? 'var(--green)' : lost ? 'var(--red2)' : 'var(--muted)'

                      return (
                        <div key={pick.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: '0.5px solid var(--border)',
                          fontSize: '12px',
                        }}>
                          <div>
                            <div style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: '13px', fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                              <Flag code={runner?.country_code} />
                              {runner?.username ?? '—'} wins
                              <span style={{
                                fontSize: '9px', fontWeight: 800,
                                padding: '1px 5px', borderRadius: '3px',
                                background: pillBg, color: pillColor,
                              }}>
                                {pick.status.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                              {race ? `W${race.week} · Rung ${race.rung}` : '—'} · {pick.odds_at_placement}pts
                            </div>
                          </div>
                          <div style={{
                            fontSize: '14px', fontWeight: 700,
                            color: won ? 'var(--green)' : lost ? 'var(--red2)' : 'var(--muted)',
                          }}>
                            {won ? `+${(pick.points_earned ?? 0).toFixed(1)}` : lost ? '✕' : '—'}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '8px', background: 'transparent', color: 'var(--muted)', border: '0.5px solid var(--border)', borderRadius: '5px', fontSize: '12px', marginBottom: '6px' }}
              >
                Close
              </button>
              <button
                onClick={onSignOut}
                style={{ width: '100%', padding: '8px', background: 'var(--red-bg)', color: 'var(--red2)', border: '0.5px solid var(--red-border)', borderRadius: '5px', fontSize: '12px', fontWeight: 600 }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}