'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Bet {
  id: string
  wager: number
  odds_at_placement: number
  potential_payout: number
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  race_runner?: {
    odds: number
    runner?: { username: string }
    race?: { week: number; rung: number; status: string; scheduled_at: string }
  }
}

interface FuturesBet {
  id: string
  wager: number
  odds_at_placement: number
  potential_payout: number
  status: 'pending' | 'won' | 'lost'
  market: string
  placed_at: string
  runner?: { username: string }
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
    futures_market_id?: string
    odds: number
    runner_username?: string
    race_week?: number
    race_rung?: number
    status?: 'pending' | 'won' | 'lost'
  }[]
  placed_at: string
}

export default function MyBets() {
  const [bets, setBets] = useState<Bet[]>([])
  const [futuresBets, setFuturesBets] = useState<FuturesBet[]>([])
  const [parlayBets, setParlayBets] = useState<ParlayBet[]>([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'active' | 'settled'>('active')
  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [
      { data: b },
      { data: fb },
      { data: pb },
    ] = await Promise.all([
      supabase
        .from('bets')
        .select(`
          id, wager, odds_at_placement, potential_payout, status, placed_at,
          race_runner:race_runners(
            odds,
            runner:runners(username),
            race:races(week, rung, status, scheduled_at)
          )
        `)
        .eq('user_id', user.id)
        .order('placed_at', { ascending: false }),
      supabase
        .from('futures_bets')
        .select('id, wager, odds_at_placement, potential_payout, status, market, placed_at, runner:runners(username)')
        .eq('user_id', user.id)
        .order('placed_at', { ascending: false }),
      supabase
        .from('parlay_bets')
        .select('*')
        .eq('user_id', user.id)
        .order('placed_at', { ascending: false }),
    ])

    setBets((b as unknown as Bet[]) ?? [])
    setFuturesBets((fb as unknown as FuturesBet[]) ?? [])
    setParlayBets((pb as unknown as ParlayBet[]) ?? [])
    setLoading(false)
  }

  const activeBets = bets.filter(b => b.status === 'pending')
  const settledBets = bets.filter(b => b.status !== 'pending')
  const activeFutures = futuresBets.filter(b => b.status === 'pending')
  const settledFutures = futuresBets.filter(b => b.status !== 'pending')
  const activeParlays = parlayBets.filter(b => b.status === 'pending')
  const settledParlays = parlayBets.filter(b => b.status !== 'pending')

  const totalActive = activeBets.length + activeFutures.length + activeParlays.length
  const totalSettled = settledBets.length + settledFutures.length + settledParlays.length

  function resultColor(status: string) {
    if (status === 'won') return 'var(--green)'
    if (status === 'lost') return 'var(--red2)'
    return 'var(--muted)'
  }

  function resultText(status: string, wager: number, payout: number) {
    if (status === 'won') return `+${(payout - wager).toLocaleString()}`
    if (status === 'lost') return `−${wager.toLocaleString()}`
    return '—'
  }

  function BetRow({ label, sublabel, wager, odds, payout, status, date }: {
    label: string
    sublabel: string
    wager: number
    odds: number
    payout: number
    status: string
    date: string
  }) {
    return (
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--border)',
        borderRadius: '7px',
        padding: '10px 12px',
        marginBottom: '6px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px', fontWeight: 700,
              color: 'var(--white)', letterSpacing: '.2px',
            }}>
              {label}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
              {sublabel}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '14px', fontWeight: 700,
              color: resultColor(status),
            }}>
              {resultText(status, wager, payout)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
              {status === 'pending' ? `${wager.toLocaleString()} wagered` : status.toUpperCase()}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: '12px',
          marginTop: '7px', paddingTop: '7px',
          borderTop: '0.5px solid var(--border)',
          fontSize: '11px', color: 'var(--muted)',
        }}>
          <span>Wager: <strong style={{ color: 'var(--white)' }}>{wager.toLocaleString()}</strong></span>
          <span>Odds: <strong style={{ color: 'var(--gold)' }}>{odds}x</strong></span>
          <span>Payout: <strong style={{ color: 'var(--white)' }}>{payout.toLocaleString()}</strong></span>
          <span style={{ marginLeft: 'auto' }}>
            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    )
  }

  function ParlayRow({ parlay }: { parlay: ParlayBet }) {
  const [open, setOpen] = useState(true)

  const legStatusIcon = (status: string) => {
    if (status === 'won') return (
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'var(--green-bg)', border: '1px solid var(--green-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '10px', color: 'var(--green)',
      }}>✓</div>
    )
    if (status === 'lost') return (
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'var(--red-bg)', border: '1px solid var(--red-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '10px', color: 'var(--red2)',
      }}>✕</div>
    )
    return (
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'var(--navy3)', border: '1px solid var(--borderb)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '8px', color: 'var(--dim)',
      }}>•</div>
    )
  }

  const wonLegs = parlay.legs.filter((l: any) => l.status === 'won').length
  const lostLegs = parlay.legs.filter((l: any) => l.status === 'lost').length
  const pendingLegs = parlay.legs.filter((l: any) => l.status === 'pending').length

  return (
    <div style={{
      background: 'var(--navy2)',
      border: `0.5px solid ${
        parlay.status === 'won' ? 'var(--green-border)'
        : parlay.status === 'lost' ? 'var(--red-border)'
        : 'var(--gold-dim)'
      }`,
      borderRadius: '7px',
      marginBottom: '6px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '10px 12px',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', cursor: 'pointer',
          background: 'var(--navy3)',
        }}
      >
        <div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{
              fontSize: '9px', fontWeight: 800,
              padding: '1px 6px', borderRadius: '3px',
              background: 'var(--gold-bg)', color: 'var(--gold)',
              border: '1px solid var(--gold-dim)',
            }}>
              {parlay.legs.length}-LEG PARLAY
            </span>
            {parlay.bet_type === 'futures' ? 'Futures' : 'Race'} Parlay
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
            <span>{parlay.combined_odds.toFixed(2)}x</span>
            <span>·</span>
            <span>{parlay.wager.toLocaleString()} wagered</span>
            <span>·</span>
            {parlay.status === 'pending' && (
              <span style={{ color: 'var(--muted)' }}>{wonLegs}/{parlay.legs.length} legs done</span>
            )}
            {parlay.status === 'won' && (
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>WON</span>
            )}
            {parlay.status === 'lost' && (
              <span style={{ color: 'var(--red2)', fontWeight: 700 }}>LOST</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{
              fontSize: '15px', fontWeight: 700,
              color: parlay.status === 'won' ? 'var(--green)'
                : parlay.status === 'lost' ? 'var(--red2)'
                : 'var(--gold)',
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              {parlay.status === 'won'
                ? `+${(parlay.potential_payout - parlay.wager).toLocaleString()}`
                : parlay.status === 'lost'
                ? `−${parlay.wager.toLocaleString()}`
                : parlay.potential_payout.toLocaleString()
              }
            </div>
            <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
              {parlay.status === 'pending' ? 'potential' : parlay.status}
            </div>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--dim)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Legs */}
      {open && (
        <div style={{ padding: '6px 12px 10px' }}>
          {/* Progress bar */}
          {parlay.status === 'pending' && parlay.legs.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                height: '3px', background: 'var(--navy4)',
                borderRadius: '2px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(wonLegs / parlay.legs.length) * 100}%`,
                  background: lostLegs > 0 ? 'var(--red2)' : 'var(--green)',
                  borderRadius: '2px',
                  transition: 'width .4s ease',
                }} />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '3px' }}>
                {wonLegs} won · {lostLegs} lost · {pendingLegs} pending
              </div>
            </div>
          )}

          {parlay.legs.map((leg: any, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 0',
              borderBottom: i < parlay.legs.length - 1 ? '0.5px solid var(--border)' : 'none',
            }}>
              {legStatusIcon(leg.status ?? 'pending')}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '13px', fontWeight: 700,
                  color: leg.status === 'won' ? 'var(--green)'
                    : leg.status === 'lost' ? 'var(--red2)'
                    : 'var(--white)',
                }}>
                  {leg.runner_username ?? `Leg ${i + 1}`} wins
                </div>
                <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
                  {leg.race_week ? `W${leg.race_week} · Rung ${leg.race_rung}` : ''}
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)' }}>
                {leg.odds}x
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading bets...</div>
  }

  return (
    <div>
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
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '6px',
          }}
        >
          Active
          {totalActive > 0 && (
            <span style={{
              background: 'var(--red2)', color: '#fff',
              borderRadius: '10px', fontSize: '10px',
              fontWeight: 700, padding: '1px 6px',
            }}>
              {totalActive}
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
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '6px',
          }}
        >
          Settled
          {totalSettled > 0 && (
            <span style={{
              background: 'var(--green)', color: '#fff',
              borderRadius: '10px', fontSize: '10px',
              fontWeight: 700, padding: '1px 6px',
            }}>
              {totalSettled}
            </span>
          )}
        </button>
      </div>

      {section === 'active' && (
        <>
          {totalActive === 0 && (
            <div style={{ color: 'var(--dim)', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎯</div>
              No active bets. Head to Races or Futures to place a bet.
            </div>
          )}

          {activeParlays.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '6px' }}>
                Parlays
              </div>
              {activeParlays.map(p => <ParlayRow key={p.id} parlay={p} />)}
            </>
          )}

          {activeBets.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '6px', marginTop: activeParlays.length ? '10px' : '0' }}>
                Race Bets
              </div>
              {activeBets.map(b => (
                <BetRow
                  key={b.id}
                  label={`${b.race_runner?.runner?.username ?? '—'} wins`}
                  sublabel={`W${b.race_runner?.race?.week} · Rung ${b.race_runner?.race?.rung}`}
                  wager={b.wager}
                  odds={b.odds_at_placement}
                  payout={b.potential_payout}
                  status={b.status}
                  date={b.placed_at}
                />
              ))}
            </>
          )}

          {activeFutures.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '6px', marginTop: '10px' }}>
                Futures
              </div>
              {activeFutures.map(b => (
                <BetRow
                  key={b.id}
                  label={`${b.runner?.username ?? '—'}`}
                  sublabel={b.market === 'champion' ? 'Season Champion' : 'Top 8 Qualification'}
                  wager={b.wager}
                  odds={b.odds_at_placement}
                  payout={b.potential_payout}
                  status={b.status}
                  date={b.placed_at}
                />
              ))}
            </>
          )}
        </>
      )}

      {section === 'settled' && (
        <>
          {totalSettled === 0 && (
            <div style={{ color: 'var(--dim)', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
              No settled bets yet.
            </div>
          )}

          {settledParlays.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '6px' }}>
                Parlays
              </div>
              {settledParlays.map(p => <ParlayRow key={p.id} parlay={p} />)}
            </>
          )}

          {settledBets.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '6px', marginTop: settledParlays.length ? '10px' : '0' }}>
                Race Bets
              </div>
              {settledBets.map(b => (
                <BetRow
                  key={b.id}
                  label={`${b.race_runner?.runner?.username ?? '—'} wins`}
                  sublabel={`W${b.race_runner?.race?.week} · Rung ${b.race_runner?.race?.rung}`}
                  wager={b.wager}
                  odds={b.odds_at_placement}
                  payout={b.potential_payout}
                  status={b.status}
                  date={b.placed_at}
                />
              ))}
            </>
          )}

          {settledFutures.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '6px', marginTop: '10px' }}>
                Futures
              </div>
              {settledFutures.map(b => (
                <BetRow
                  key={b.id}
                  label={`${b.runner?.username ?? '—'}`}
                  sublabel={b.market === 'champion' ? 'Season Champion' : 'Top 8 Qualification'}
                  wager={b.wager}
                  odds={b.odds_at_placement}
                  payout={b.potential_payout}
                  status={b.status}
                  date={b.placed_at}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}