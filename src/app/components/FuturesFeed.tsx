'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface FuturesMarket {
  id: string
  market: 'champion' | 'top8_qualification'
  runner_id: string
  odds: number | null
  runner: {
    username: string
    character: string
    pb: string
    seed: number | null
    status: string
  }
}

interface UserFuturesBet {
  runner_id: string
  market: string
  status: string
  wager: number
  potential_payout: number
}

export default function FuturesFeed() {
  const [markets, setMarkets] = useState<FuturesMarket[]>([])
  const [userBets, setUserBets] = useState<UserFuturesBet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [wager, setWager] = useState(200)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchMarkets()
    fetchUserBets()
  }, [])

  async function fetchMarkets() {
    const { data } = await supabase
      .from('futures_markets')
      .select(`
        id, market, runner_id, odds,
        runner:runners(username, character, pb, seed, status)
      `)
      .order('market')
      .order('odds', { ascending: true })

    setMarkets((data as unknown as FuturesMarket[]) ?? [])
    setLoading(false)
  }

  async function fetchUserBets() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('futures_bets')
      .select('runner_id, market, status, wager, potential_payout')
      .eq('user_id', user.id)
    setUserBets((data as unknown as UserFuturesBet[]) ?? [])
  }

  async function placeBet() {
    if (!selectedKey) return
    const [market, runner_id] = selectedKey.split('::')
    const entry = markets.find(m => m.market === market && m.runner_id === runner_id)
    if (!entry || !entry.odds) return

    setPlacing(true)
    setError(null)

    const res = await fetch('/api/futures-bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market, runner_id, wager }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(`Bet placed on ${entry.runner.username}!`)
      setSelectedKey(null)
      fetchUserBets()
      setTimeout(() => setSuccess(null), 3000)
    }
    setPlacing(false)
  }

  const champion = markets.filter(m => m.market === 'champion')
  const qualification = markets.filter(m => m.market === 'top8_qualification')

  function MarketRow({ entry }: { entry: FuturesMarket }) {
    const key = `${entry.market}::${entry.runner_id}`
    const isSelected = selectedKey === key
    const userBet = userBets.find(b => b.runner_id === entry.runner_id && b.market === entry.market)
    const potentialPayout = entry.odds ? Math.floor(wager * entry.odds) : 0

    return (
      <>
        <div
          onClick={() => {
            if (userBet) return
            setSelectedKey(isSelected ? null : key)
            setError(null)
          }}
          style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center',
            padding: '7px 0',
            borderBottom: '0.5px solid var(--border)',
            cursor: userBet ? 'default' : 'pointer',
            transition: 'background .12s',
          }}
          onMouseEnter={e => {
            if (!userBet) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {entry.runner.seed && (
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: 'var(--dim)', width: '22px',
              }}>
                #{entry.runner.seed}
              </span>
            )}
            <div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px', fontWeight: 700,
                color: isSelected ? 'var(--red2)' : 'var(--white)',
                letterSpacing: '.3px',
                transition: 'color .12s',
              }}>
                {entry.runner.username}
                {userBet && (
                  <span style={{
                    fontSize: '9px', fontWeight: 800,
                    padding: '1px 5px', borderRadius: '3px',
                    background: 'var(--green-bg)', color: 'var(--green)',
                    border: '1px solid var(--green-border)',
                    marginLeft: '6px',
                  }}>YOUR BET</span>
                )}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
                {entry.runner.character} · PB {entry.runner.pb?.toString().slice(0, 7)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '14px', fontWeight: 700,
              color: 'var(--gold)',
            }}>
              {entry.odds ? `${entry.odds}x` : 'TBD'}
            </span>
            <span style={{
              fontSize: '13px',
              color: isSelected ? 'var(--red2)' : 'var(--dim)',
            }}>
              {isSelected ? '✓' : '+'}
            </span>
          </div>
        </div>

        {/* Inline wager input when selected */}
        {isSelected && !userBet && (
          <div style={{
            padding: '10px 0',
            borderBottom: '0.5px solid var(--border)',
            background: 'rgba(231,76,60,0.04)',
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                  Wager (Studs)
                </div>
                <input
                  type="number"
                  value={wager}
                  min={10}
                  step={10}
                  onChange={e => setWager(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'var(--navy3)',
                    border: '0.5px solid var(--borderb)',
                    borderRadius: '5px',
                    padding: '7px 10px',
                    color: 'var(--white)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>Est. payout</div>
                <div style={{
                  fontSize: '16px', fontWeight: 700,
                  color: 'var(--gold)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  {potentialPayout.toLocaleString()}
                </div>
              </div>
            </div>
            {error && (
              <div style={{ fontSize: '11px', color: 'var(--red2)', marginBottom: '6px' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={placeBet}
                disabled={placing || wager < 10}
                style={{
                  flex: 1, padding: '9px',
                  background: placing ? 'var(--navy4)' : 'var(--red2)',
                  color: '#fff', border: 'none', borderRadius: '5px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '15px', fontWeight: 800,
                  letterSpacing: '1px', textTransform: 'uppercase',
                  cursor: placing ? 'not-allowed' : 'pointer',
                }}
              >
                {placing ? 'Placing...' : 'Place Bet'}
              </button>
              <button
                onClick={() => setSelectedKey(null)}
                style={{
                  padding: '9px 14px',
                  background: 'transparent', color: 'var(--muted)',
                  border: '0.5px solid var(--border)', borderRadius: '5px',
                  fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading futures...</div>
  }

  return (
    <div>
      {success && (
        <div style={{
          background: 'var(--green-bg)', border: '1px solid var(--green-border)',
          color: 'var(--green)', borderRadius: '7px',
          padding: '10px 14px', marginBottom: '12px',
          fontSize: '13px', fontWeight: 600,
        }}>
          ✓ {success}
        </div>
      )}

      {/* Champion market */}
      {champion.length > 0 && (
        <div style={{
          background: 'var(--navy2)',
          border: '0.5px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '16px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>
            Season Champion
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '10px' }}>
            Winner of the Top 8 single-elimination bracket
          </div>
          {champion.map(entry => (
            <MarketRow key={`${entry.market}::${entry.runner_id}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Top 8 qualification market */}
      {qualification.length > 0 && (
        <div style={{
          background: 'var(--navy2)',
          border: '0.5px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '16px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>
            Top 8 Qualification
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '10px' }}>
            Will this runner qualify from the ladder this season?
          </div>
          {qualification.map(entry => (
            <MarketRow key={`${entry.market}::${entry.runner_id}`} entry={entry} />
          ))}
        </div>
      )}

      {!champion.length && !qualification.length && (
        <div style={{ color: 'var(--dim)', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📈</div>
          <div>No futures markets open yet.</div>
        </div>
      )}
    </div>
  )
}