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

interface FuturesFeedProps {
  slipPicks: string[]
  onAddToSlip: (id: string, runner: string, odds: number, sublabel: string) => void
  onRemoveFromSlip: (id: string) => void
}

export default function FuturesFeed({ slipPicks, onAddToSlip, onRemoveFromSlip }: FuturesFeedProps) {
  const [markets, setMarkets] = useState<FuturesMarket[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchMarkets()
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

  const champion = markets.filter(m => m.market === 'champion')
  const qualification = markets.filter(m => m.market === 'top8_qualification')

  function MarketRow({ entry }: { entry: FuturesMarket }) {
    const key = `${entry.market}::${entry.runner_id}`
    const inSlip = slipPicks.includes(key)

    return (
      <div
        onClick={() => {
          if (!entry.odds) return
          if (inSlip) {
            onRemoveFromSlip(key)
          } else {
            onAddToSlip(
              key,
              entry.runner.username,
              entry.odds,
              entry.market === 'champion' ? 'Season Champion' : 'Top 8 Qualification',
            )
          }
        }}
        style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center',
          padding: '7px 0',
          borderBottom: '0.5px solid var(--border)',
          cursor: entry.odds ? 'pointer' : 'default',
          transition: 'background .12s',
        }}
        onMouseEnter={e => {
          if (entry.odds) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'
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
              color: inSlip ? 'var(--red2)' : 'var(--white)',
              letterSpacing: '.3px',
              transition: 'color .12s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              {entry.runner.username}
              {inSlip && (
                <span style={{
                  fontSize: '9px', fontWeight: 800,
                  padding: '1px 5px', borderRadius: '3px',
                  background: 'var(--red-bg)', color: 'var(--red2)',
                  border: '1px solid var(--red-border)',
                }}>IN SLIP ✓</span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
              {entry.runner.character} · PB {entry.runner.pb?.toString().slice(0, 8)}
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
            color: inSlip ? 'var(--red2)' : 'var(--dim)',
          }}>
            {inSlip ? '✓' : '+'}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading futures...</div>
  }

  return (
    <div>
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