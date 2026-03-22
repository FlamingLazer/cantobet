'use client'

import type { RaceWithRunners, RaceRunner } from '@/types'

interface RaceCardProps {
  race: RaceWithRunners
  userBets: Record<string, string>
  onBetPlaced: (raceRunnerId: string, raceId: string) => void
  slipPicks: string[]
  onAddToSlip: (id: string, runner: string, odds: number, label: string, raceId: string) => void
  onRemoveFromSlip: (id: string) => void
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

function formatPB(pb?: string): string {
  if (!pb) return '—'
  return pb.toString().slice(0, 8)
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

export default function RaceCard({
  race,
  userBets,
  onBetPlaced,
  slipPicks,
  onAddToSlip,
  onRemoveFromSlip,
}: RaceCardProps) {
  const rungStyle = rungColors[race.rung] ?? rungColors[7]
  const isLocked = race.status === 'locked'
  const isPast = new Date(race.scheduled_at) <= new Date()
  const existingBet = userBets[race.id]

  const eliminationRung = 8 - race.week
  const isEliminationRung = race.rung === eliminationRung

  const rungNote = race.rung === 1
    ? 'Winner qualifies for Top 8'
    : isEliminationRung
    ? '2nd & 3rd eliminated'
    : 'Top 2 advance · Last drops'

  const scheduledTime = new Date(race.scheduled_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })

  return (
    <div style={{
      background: 'var(--navy3)',
      border: '0.5px solid var(--border)',
      borderRadius: '8px',
      marginBottom: '8px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--navy4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 800,
            padding: '2px 8px', borderRadius: '3px',
            letterSpacing: '.8px',
            fontFamily: "'Barlow Condensed', sans-serif",
            background: rungStyle.bg,
            color: rungStyle.color,
            border: `1px solid ${rungStyle.border}`,
          }}>
            RUNG {race.rung}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
            {rungNote}
          </span>
        </div>

        {isLocked || isPast ? (
          <span style={{
            fontSize: '10px', fontWeight: 700,
            color: 'var(--gold)',
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-dim)',
            borderRadius: '3px', padding: '1px 6px',
          }}>
            🔒 LOCKED
          </span>
        ) : (
          <span style={{ fontSize: '10px', color: 'var(--dim)' }}>
            {scheduledTime}
          </span>
        )}
      </div>

      {/* Runners */}
      <div style={{
        padding: '7px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
      }}>
        {race.race_runners.map((rr: RaceRunner) => (
          <div key={rr.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 8px',
            background: 'var(--navy2)',
            borderRadius: '4px',
            border: '0.5px solid var(--border)',
          }}>
            <span style={{
              fontSize: '13px', fontWeight: 700, flex: 1,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '.3px',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <Flag code={rr.runner?.country_code} />
              {rr.runner?.username}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
              {rr.runner?.character}
            </span>
            <span style={{
              fontSize: '10px', color: 'var(--dim)',
              marginLeft: 'auto', whiteSpace: 'nowrap',
            }}>
              PB {formatPB(rr.runner?.pb?.toString())}
            </span>
          </div>
        ))}
      </div>

      {/* Odds buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '5px',
        padding: '7px 12px',
        borderTop: '0.5px solid var(--border)',
      }}>
        {race.race_runners.map((rr: RaceRunner) => {
          const alreadyBet = existingBet === rr.id
          const inSlip = slipPicks.includes(rr.id)
          const anotherPickInThisRace = slipPicks.some(id =>
            race.race_runners.some(r => r.id === id && r.id !== rr.id)
          )
          const disabled = isLocked || isPast || !!existingBet

          return (
            <button
              key={rr.id}
              disabled={disabled}
              onClick={() => {
                if (inSlip) {
                  onRemoveFromSlip(rr.id)
                } else {
                  onAddToSlip(
                    rr.id,
                    rr.runner?.username ?? '',
                    rr.odds ?? 0,
                    `W${race.week} · Rung ${race.rung}`,
                    race.id,
                  )
                }
              }}
              style={{
                padding: '7px 5px',
                borderRadius: '5px',
                border: `0.5px solid ${
                  inSlip ? 'var(--red2)'
                  : alreadyBet ? 'var(--green)'
                  : 'var(--borderb)'
                }`,
                background: inSlip ? 'var(--red-bg)'
                  : alreadyBet ? 'var(--green-bg)'
                  : 'var(--navy2)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !alreadyBet ? 0.5
                  : anotherPickInThisRace && !inSlip ? 0.4
                  : 1,
                transition: 'all .15s',
              }}
            >
              <div style={{
                fontSize: '9px', color: 'var(--dim)',
                letterSpacing: '.5px', fontWeight: 700,
              }}>
                {alreadyBet ? 'YOUR BET' : inSlip ? 'IN SLIP ✓' : 'WINS'}
              </div>
              <div style={{
                fontSize: '11px', fontWeight: 700,
                color: 'var(--white)',
                fontFamily: "'Barlow Condensed', sans-serif",
                textAlign: 'center',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '3px',
              }}>
                <Flag code={rr.runner?.country_code} />
                {rr.runner?.username}
              </div>
              <div style={{
                fontSize: '13px', fontWeight: 700,
                color: 'var(--gold)',
              }}>
                {rr.odds ? `${rr.odds}x` : 'TBD'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}