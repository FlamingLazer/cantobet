'use client'

import { useState } from 'react'

export interface SlipPick {
  id: string           // race_runner_id or futures_market_id
  type: 'race' | 'future'
  label: string        // e.g. "itsjared97 wins"
  sublabel: string     // e.g. "W1 · Rung 1"
  odds: number
  raceId?: string      // for deduplication — one pick per race
}

interface BetSlipProps {
  picks: SlipPick[]
  onRemove: (id: string) => void
  onClear: () => void
  onBetsPlaced: (newBalance: number) => void
  studsBalance: number
}

type SlipMode = 'singles' | 'parlay'

export default function BetSlip({ picks, onRemove, onClear, onBetsPlaced, studsBalance }: BetSlipProps) {
  const [mode, setMode] = useState<SlipMode>('singles')
  const [wager, setWager] = useState(200)
  const [singlesWagers, setSinglesWagers] = useState<Record<string, number>>({})
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const racePicks = picks.filter(p => p.type === 'race')
  const futurePicks = picks.filter(p => p.type === 'future')

  const parlayOdds = picks.reduce((acc, p) => acc * p.odds, 1)
  const parlayPayout = Math.floor(wager * parlayOdds)

  const totalSinglesWager = picks.reduce((acc, p) => acc + (singlesWagers[p.id] ?? 200), 0)

  function getSinglesWager(id: string) {
    return singlesWagers[id] ?? 200
  }

  function setSinglesWager(id: string, val: number) {
    setSinglesWagers(prev => ({ ...prev, [id]: val }))
  }

  async function placeBets() {
    setPlacing(true)
    setError(null)

    try {
      if (mode === 'parlay') {
        // All picks must be same type for parlay
        const allRaces = picks.every(p => p.type === 'race')
        const allFutures = picks.every(p => p.type === 'future')

        if (!allRaces && !allFutures) {
          setError('Parlays must be all races or all futures')
          setPlacing(false)
          return
        }

        if (picks.length < 2) {
          setError('Add at least 2 picks for a parlay')
          setPlacing(false)
          return
        }

        const endpoint = allRaces ? '/api/bets/parlay' : '/api/futures-bets/parlay'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            picks: picks.map(p => ({ id: p.id, odds: p.odds })),
            wager,
            combined_odds: parlayOdds,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error)
        } else {
          setSuccess(`Parlay placed! Potential payout: ${parlayPayout.toLocaleString()} Studs`)
          onBetsPlaced(data.new_balance)
          onClear()
          setTimeout(() => setSuccess(null), 4000)
        }
      } else {
        // Singles — place each bet individually
        let newBalance = studsBalance
        const errors: string[] = []

        for (const pick of picks) {
          const w = getSinglesWager(pick.id)
          const endpoint = pick.type === 'race' ? '/api/bets' : '/api/futures-bets'
          const body = pick.type === 'race'
            ? { race_runner_id: pick.id, wager: w }
            : { runner_id: pick.id.split('::')[1], market: pick.id.split('::')[0], wager: w }

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (!res.ok) {
            errors.push(`${pick.label}: ${data.error}`)
          } else {
            newBalance = data.new_balance
          }
        }

        if (errors.length) {
          setError(errors.join(' · '))
        } else {
          setSuccess(`${picks.length} bet${picks.length > 1 ? 's' : ''} placed!`)
          onBetsPlaced(newBalance)
          onClear()
          setTimeout(() => setSuccess(null), 4000)
        }
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setPlacing(false)
    }
  }

  if (!picks.length) {
    return (
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '16px', fontWeight: 800,
          letterSpacing: '.5px', textTransform: 'uppercase',
          marginBottom: '10px',
        }}>
          Bet Slip
        </div>
        <div style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.8 }}>
          No picks yet.<br />Click a runner to add to slip.
        </div>
      </div>
    )
  }

  const canParlay = picks.length >= 2 && (
    picks.every(p => p.type === 'race') || picks.every(p => p.type === 'future')
  )

  return (
    <div style={{
      background: 'var(--navy2)',
      border: '0.5px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: 'var(--navy3)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '16px', fontWeight: 800,
          letterSpacing: '.5px', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          Bet Slip
          <span style={{
            background: 'var(--red2)', color: '#fff',
            borderRadius: '10px', fontSize: '11px',
            fontWeight: 700, padding: '2px 7px',
          }}>
            {picks.length}
          </span>
        </div>
        <button
          onClick={onClear}
          style={{
            background: 'none', border: 'none',
            color: 'var(--dim)', fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Clear all
        </button>
      </div>

      <div style={{ padding: '10px 12px' }}>

        {/* Mode toggle */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: canParlay ? '1fr 1fr' : '1fr',
          gap: '5px',
          marginBottom: '10px',
        }}>
          <button
            onClick={() => setMode('singles')}
            style={{
              padding: '6px',
              borderRadius: '5px',
              border: `0.5px solid ${mode === 'singles' ? 'var(--red2)' : 'var(--border)'}`,
              background: mode === 'singles' ? 'var(--red-bg)' : 'var(--navy3)',
              color: mode === 'singles' ? 'var(--red2)' : 'var(--muted)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '12px', fontWeight: 800,
              letterSpacing: '.5px', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Singles
          </button>
          {canParlay && (
            <button
              onClick={() => setMode('parlay')}
              style={{
                padding: '6px',
                borderRadius: '5px',
                border: `0.5px solid ${mode === 'parlay' ? 'var(--gold-dim)' : 'var(--border)'}`,
                background: mode === 'parlay' ? 'var(--gold-bg)' : 'var(--navy3)',
                color: mode === 'parlay' ? 'var(--gold)' : 'var(--muted)',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '12px', fontWeight: 800,
                letterSpacing: '.5px', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Parlay
            </button>
          )}
        </div>

        {/* Picks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {picks.map(pick => (
            <div key={pick.id} style={{
              background: 'var(--navy3)',
              border: '0.5px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 10px',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: mode === 'singles' ? '6px' : '0',
              }}>
                <div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '13px', fontWeight: 700,
                    color: 'var(--white)',
                  }}>
                    {pick.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    {pick.sublabel} · <span style={{ color: 'var(--gold)' }}>{pick.odds}x</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(pick.id)}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--dim)', fontSize: '13px',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Per-pick wager in singles mode */}
              {mode === 'singles' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={getSinglesWager(pick.id)}
                    min={10} step={10}
                    onChange={e => setSinglesWager(pick.id, Number(e.target.value))}
                    style={{
                      flex: 1,
                      background: 'var(--navy2)',
                      border: '0.5px solid var(--borderb)',
                      borderRadius: '4px',
                      padding: '5px 8px',
                      color: 'var(--white)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    → {Math.floor(getSinglesWager(pick.id) * pick.odds).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Parlay wager */}
        {mode === 'parlay' && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '11px', color: 'var(--muted)',
              marginBottom: '4px',
            }}>
              <span>Combined odds</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                {parlayOdds.toFixed(2)}x
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                value={wager}
                min={10} step={10}
                onChange={e => setWager(Number(e.target.value))}
                style={{
                  flex: 1,
                  background: 'var(--navy3)',
                  border: '0.5px solid var(--borderb)',
                  borderRadius: '5px',
                  padding: '7px 10px',
                  color: 'var(--white)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Payout</div>
                <div style={{
                  fontSize: '16px', fontWeight: 700,
                  color: 'var(--gold)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  {parlayPayout.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Singles total */}
        {mode === 'singles' && picks.length > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '11px', color: 'var(--muted)',
            marginBottom: '8px',
            paddingTop: '6px',
            borderTop: '0.5px solid var(--border)',
          }}>
            <span>Total wager</span>
            <span style={{ color: 'var(--white)', fontWeight: 600 }}>
              {totalSinglesWager.toLocaleString()} Studs
            </span>
          </div>
        )}

        {error && (
          <div style={{
            fontSize: '11px', color: 'var(--red2)',
            marginBottom: '8px', lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            fontSize: '11px', color: 'var(--green)',
            marginBottom: '8px',
            background: 'var(--green-bg)',
            border: '1px solid var(--green-border)',
            borderRadius: '5px',
            padding: '6px 8px',
          }}>
            ✓ {success}
          </div>
        )}

        <button
          onClick={placeBets}
          disabled={placing || (mode === 'singles' ? totalSinglesWager > studsBalance : wager > studsBalance)}
          style={{
            width: '100%', padding: '10px',
            background: placing ? 'var(--navy4)' : mode === 'parlay' ? 'var(--gold)' : 'var(--red2)',
            color: mode === 'parlay' ? '#000' : '#fff',
            border: 'none', borderRadius: '6px',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '15px', fontWeight: 800,
            letterSpacing: '1px', textTransform: 'uppercase',
            cursor: placing ? 'not-allowed' : 'pointer',
            transition: 'all .15s',
          }}
        >
          {placing
            ? 'Placing...'
            : mode === 'parlay'
            ? `Place Parlay · ${parlayOdds.toFixed(2)}x`
            : `Place ${picks.length} Bet${picks.length > 1 ? 's' : ''}`}
        </button>

        <div style={{
          fontSize: '10px', color: 'var(--dim)',
          textAlign: 'center', marginTop: '6px',
        }}>
          Balance: {studsBalance.toLocaleString()} Studs
        </div>
      </div>
    </div>
  )
}