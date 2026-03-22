'use client'

import { useState, useEffect } from 'react'

interface Bet {
  id: string
  wager: number
  odds_at_placement: number
  potential_payout: number
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  race_runner?: {
    odds: number
    runner?: { username: string; character: string }
    race?: { week: number; rung: number; status: string }
  }
}

interface ParlayBet {
  id: string
  wager: number
  combined_odds: number
  potential_payout: number
  status: 'pending' | 'won' | 'lost'
  bet_type: string
  legs: {
    race_runner_id?: string
    odds: number
    runner_username?: string
    race_week?: number
    race_rung?: number
    status?: string
  }[]
  placed_at: string
}

interface WatchSession {
  id: string
  started_at: string
  studs_credited: number
}

interface ProfileData {
  stats: {
    studs_balance: number
    bet_profit_loss: number
    watch_studs_earned: number
    total_watch_minutes: number
  }
  bets: Bet[]
  parlay_bets: ParlayBet[]
  watch_sessions: WatchSession[]
}

interface ProfileModalProps {
  userId: string
  username: string
  isAdmin: boolean
  onClose: () => void
  onSignOut: () => void
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

  const pl = data?.stats.bet_profit_loss ?? 0
  const plColor = pl > 0 ? 'var(--green)' : pl < 0 ? 'var(--red2)' : 'var(--muted)'
  const plText = pl > 0 ? `+${pl.toLocaleString()}` : pl.toLocaleString()

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
        width: '520px',
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
            fontSize: '18px', fontWeight: 800, letterSpacing: '.5px',
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
                  { val: (data?.stats.studs_balance ?? 0).toLocaleString(), label: 'Studs balance', color: 'var(--gold)' },
                  { val: plText, label: 'Bet profit / loss', color: plColor },
                  { val: (data?.stats.watch_studs_earned ?? 0).toLocaleString(), label: 'Studs from watching', color: 'var(--blue)' },
                  { val: `${Math.floor((data?.stats.total_watch_minutes ?? 0) / 60)}h ${(data?.stats.total_watch_minutes ?? 0) % 60}m`, label: 'Watch time', color: 'var(--muted)' },
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

              {/* Bet History */}
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', margin: '12px 0 6px' }}>
                Bet History
              </div>
              <div style={{ background: 'var(--navy2)', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 55px 60px 65px', gap: '6px', padding: '0 0 6px', borderBottom: '0.5px solid var(--border)', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    <span>Race</span><span>Pick</span><span style={{ textAlign: 'right' }}>Wager</span><span style={{ textAlign: 'right' }}>Odds</span><span style={{ textAlign: 'right' }}>Result</span>
                  </div>

                  {!data?.bets.length && !data?.parlay_bets.length ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--dim)', fontSize: '12px' }}>No bets yet</div>
                  ) : (
                    <>
                      {/* Straight bets */}
                      {(data?.bets ?? []).map(bet => {
                        const race = bet.race_runner?.race
                        const runner = bet.race_runner?.runner
                        const resultColor = bet.status === 'won' ? 'var(--green)' : bet.status === 'lost' ? 'var(--red2)' : 'var(--muted)'
                        const resultText = bet.status === 'won' ? `+${(bet.potential_payout - bet.wager).toLocaleString()}` : bet.status === 'lost' ? `-${bet.wager.toLocaleString()}` : '—'
                        const pillBg = bet.status === 'won' ? 'var(--green-bg)' : bet.status === 'lost' ? 'var(--red-bg)' : 'var(--navy4)'
                        const pillColor = bet.status === 'won' ? 'var(--green)' : bet.status === 'lost' ? 'var(--red2)' : 'var(--muted)'
                        return (
                          <div key={bet.id} style={{ display: 'grid', gridTemplateColumns: '85px 1fr 55px 60px 65px', gap: '6px', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: '12px' }}>
                            <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                              {race ? `W${race.week} · R${race.rung}` : 'Futures'}
                            </div>
                            <div>
                              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {runner?.username ?? '—'}
                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: pillBg, color: pillColor }}>
                                  {bet.status.toUpperCase()}
                                </span>
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--dim)' }}>wins race</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>{bet.wager.toLocaleString()}</div>
                            <div style={{ textAlign: 'right', color: 'var(--muted)' }}>{bet.odds_at_placement}x</div>
                            <div style={{ textAlign: 'right', fontWeight: 700, color: resultColor }}>{resultText}</div>
                          </div>
                        )
                      })}

                      {/* Parlay bets */}
                      {(data?.parlay_bets ?? []).map(parlay => {
                        const resultColor = parlay.status === 'won' ? 'var(--green)' : parlay.status === 'lost' ? 'var(--red2)' : 'var(--muted)'
                        const resultText = parlay.status === 'won'
                          ? `+${(parlay.potential_payout - parlay.wager).toLocaleString()}`
                          : parlay.status === 'lost'
                          ? `-${parlay.wager.toLocaleString()}`
                          : '—'
                        const pillBg = parlay.status === 'won' ? 'var(--green-bg)' : parlay.status === 'lost' ? 'var(--red-bg)' : 'var(--navy4)'
                        const pillColor = parlay.status === 'won' ? 'var(--green)' : parlay.status === 'lost' ? 'var(--red2)' : 'var(--muted)'

                        return (
                          <div key={parlay.id} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{
                                  fontSize: '9px', fontWeight: 800,
                                  padding: '1px 5px', borderRadius: '3px',
                                  background: 'var(--gold-bg)', color: 'var(--gold)',
                                  border: '1px solid var(--gold-dim)',
                                }}>
                                  {parlay.legs.length}-LEG PARLAY
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: pillBg, color: pillColor }}>
                                  {parlay.status.toUpperCase()}
                                </span>
                              </div>
                              <span style={{ fontWeight: 700, color: resultColor }}>{resultText}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {parlay.legs.map((leg, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted)' }}>
                                  <span style={{
                                    fontSize: '9px',
                                    color: leg.status === 'won' ? 'var(--green)'
                                      : leg.status === 'lost' ? 'var(--red2)'
                                      : 'var(--dim)',
                                  }}>
                                    {leg.status === 'won' ? '✓' : leg.status === 'lost' ? '✕' : '•'}
                                  </span>
                                  <span style={{
                                    color: leg.status === 'won' ? 'var(--green)'
                                      : leg.status === 'lost' ? 'var(--red2)'
                                      : 'var(--white)',
                                  }}>
                                    {leg.runner_username ?? `Leg ${i + 1}`} wins
                                  </span>
                                  {leg.race_week && (
                                    <span style={{ color: 'var(--dim)', fontSize: '10px' }}>
                                      W{leg.race_week} · R{leg.race_rung}
                                    </span>
                                  )}
                                  <span style={{ color: 'var(--gold)', marginLeft: 'auto' }}>{leg.odds}x</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '4px' }}>
                              {parlay.wager.toLocaleString()} wagered · {parlay.combined_odds.toFixed(2)}x combined · {parlay.potential_payout.toLocaleString()} potential
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>

              {/* Watch Time */}
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', margin: '12px 0 6px' }}>
                Watch Time History
              </div>
              <div style={{ background: 'var(--navy2)', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ padding: '8px 12px' }}>
                  {!data?.watch_sessions.length ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--dim)', fontSize: '12px' }}>No watch sessions yet</div>
                  ) : data.watch_sessions.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stream
                      </span>
                      <span>{Math.round(s.studs_credited / 10)} min</span>
                      <span style={{ color: 'var(--gold)', fontWeight: 600 }}>+{s.studs_credited.toLocaleString()} Studs</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px', paddingTop: '8px', borderTop: '0.5px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Total Studs from watching</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+{(data?.stats.watch_studs_earned ?? 0).toLocaleString()} Studs</span>
                  </div>
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