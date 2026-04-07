'use client'

import { useState } from 'react'
import type { RaceWithRunners, RaceRunner } from '@/types'

interface RaceCardProps {
  race: RaceWithRunners
  userPicks: Record<string, string>
  onPickPlaced: (raceRunnerId: string, raceId: string) => void
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
  userPicks,
  onPickPlaced,
  slipPicks,
  onAddToSlip,
  onRemoveFromSlip,
}: RaceCardProps) {
  const [selectedRR, setSelectedRR] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rungStyle = rungColors[race.rung] ?? rungColors[7]
  const isLocked = race.status === 'locked'
  const isPast = new Date(race.scheduled_at) <= new Date()
  const existingPick = userPicks[race.id]

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

  async function confirmPick() {
    if (!selectedRR || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_runner_id: selectedRR }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
      } else {
        onPickPlaced(selectedRR, race.id)
        setSelectedRR(null)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedRunner = race.race_runners.find(rr => rr.id === selectedRR)

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

      {/* Predict buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '5px',
        padding: '7px 12px',
        borderTop: '0.5px solid var(--border)',
      }}>
        {race.race_runners.map((rr: RaceRunner) => {
          const isPicked = existingPick === rr.id
          const isSelected = selectedRR === rr.id
          const disabled = isLocked || isPast || !!existingPick

          return (
            <button
              key={rr.id}
              disabled={disabled}
              onClick={() => {
                if (disabled) return
                setSelectedRR(isSelected ? null : rr.id)
                setError(null)
              }}
              style={{
                padding: '7px 5px',
                borderRadius: '5px',
                border: `0.5px solid ${
                  isPicked ? 'var(--green)'
                  : isSelected ? 'var(--red2)'
                  : 'var(--borderb)'
                }`,
                background: isPicked ? 'var(--green-bg)'
                  : isSelected ? 'var(--red-bg)'
                  : 'var(--navy2)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !isPicked ? 0.5 : 1,
                transition: 'all .15s',
              }}
            >
              <div style={{
                fontSize: '9px', color: 'var(--dim)',
                letterSpacing: '.5px', fontWeight: 700,
              }}>
                {isPicked ? 'YOUR PICK ✓' : isSelected ? 'SELECTED' : 'PREDICT'}
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
                {rr.odds ? `${rr.odds}pts` : 'TBD'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirmation panel */}
      {selectedRR && !existingPick && (
        <div style={{
          padding: '10px 12px',
          borderTop: '0.5px solid var(--border)',
          background: 'var(--navy2)',
        }}>
          <div style={{
            fontSize: '12px', color: 'var(--muted)',
            marginBottom: '8px', textAlign: 'center',
          }}>
            Predict <strong style={{ color: 'var(--white)' }}>
              {selectedRunner?.runner?.username}
            </strong> wins for{' '}
            <strong style={{ color: 'var(--gold)' }}>
              {selectedRunner?.odds}pts
            </strong> if correct
          </div>

          {error && (
            <div style={{
              fontSize: '11px', color: 'var(--red2)',
              marginBottom: '8px', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={confirmPick}
              disabled={submitting}
              style={{
                flex: 1, padding: '9px',
                background: submitting ? 'var(--navy4)' : 'var(--red2)',
                color: '#fff', border: 'none', borderRadius: '6px',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '15px', fontWeight: 800,
                letterSpacing: '1px', textTransform: 'uppercase',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Confirming...' : 'Confirm Pick'}
            </button>
            <button
              onClick={() => { setSelectedRR(null); setError(null) }}
              style={{
                padding: '9px 14px',
                background: 'transparent', color: 'var(--muted)',
                border: '0.5px solid var(--border)', borderRadius: '6px',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}