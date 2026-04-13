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
  loggedIn?: boolean
  ladderPbs?: Record<string, string>
}

const rungColors: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: 'var(--gold-bg)', color: 'var(--gold)', border: 'var(--gold-dim)' },
  2: { bg: 'var(--navy3)', color: '#6a80b0', border: '#3d4a80' },
  3: { bg: 'var(--navy3)', color: '#6a80b0', border: '#3d4a80' },
  4: { bg: 'var(--navy3)', color: '#6a80b0', border: '#3d4a80' },
  5: { bg: 'var(--navy3)', color: '#6a80b0', border: '#3d4a80' },
  6: { bg: 'var(--navy3)', color: '#6a80b0', border: '#3d4a80' },
  7: { bg: 'var(--navy3)', color: '#6a80b0', border: '#3d4a80' },
}

function formatPB(pb?: string): string {
  if (!pb) return '—'
  const s = pb.toString().slice(0, 8)
  return s.startsWith('0') ? s.slice(1) : s
}

function Flag({ code }: { code?: string | null }) {
  if (!code) return null
  return (
    <span
      className={`fi fi-${code.toLowerCase()}`}
      style={{ width: '22px', height: '16px', borderRadius: '2px', flexShrink: 0 }}
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
  loggedIn = false,
  ladderPbs = {},
}: RaceCardProps) {
  const [selectedRR, setSelectedRR] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rungStyle = rungColors[race.rung] ?? rungColors[7]
  const isLocked = race.status === 'locked'
  const isPast = !race.manually_unlocked && new Date(race.scheduled_at) <= new Date()
  const existingPick = userPicks[race.id]

  const eliminationRung = 8 - race.week
  const isEliminationRung = race.rung === eliminationRung

  const rungNote = race.rung === 1
    ? 'Winner qualifies for Top 8'
    : isEliminationRung
    ? '2nd & 3rd eliminated'
    : ''

  const scheduledTime = new Date(race.scheduled_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
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
            fontSize: '12px', fontWeight: 800,
            padding: '2px 8px', borderRadius: '3px',
            fontFamily: "'Montserrat', sans-serif",
            background: rungStyle.bg,
            color: rungStyle.color,
            border: `1px solid ${rungStyle.border}`,
          }}>
            {race.stage ?? `Rung ${race.rung}`}
          </span>
          {!race.stage && (
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {rungNote}
            </span>
          )}
        </div>

        {isLocked || isPast ? (
          <span style={{
            fontSize: '12px', fontWeight: 700,
            color: 'var(--gold)',
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-dim)',
            borderRadius: '3px', padding: '1px 6px',
          }}>
            🔒 LOCKED
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--dim)' }}>
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
              fontSize: '15px', fontWeight: 700, flex: 1,
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: '.3px', color: 'var(--white)',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <Flag code={rr.runner?.country_code} />
              {rr.runner?.username}
            </span>
            <span className="mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: '0', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
              <span style={{ width: '55px', textAlign: 'left', fontSize: '11px', color: 'var(--dim)' }}>
                {rr.runner?.seed != null ? `Seed ${rr.runner.seed}` : ''}
              </span>
              <span style={{ width: '140px', textAlign: 'left', fontSize: '11px', color: 'var(--muted)' }}>
                {rr.runner?.id && ladderPbs[rr.runner.id] ? `Ladder PB: ${formatPB(ladderPbs[rr.runner.id])}` : ''}
              </span>
              <span style={{ width: '90px', textAlign: 'left', fontSize: '11px', color: 'var(--dim)' }}>
                {rr.runner?.pb ? `PB: ${formatPB(rr.runner.pb)}` : ''}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Predict buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: race.race_runners.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
        gap: '5px',
        padding: '7px 12px',
        borderTop: '0.5px solid var(--border)',
      }}>
        {race.race_runners.map((rr: RaceRunner) => {
          const isPicked = existingPick === rr.id
          const isSelected = selectedRR === rr.id
          const disabled = isLocked || isPast

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
                  : isSelected ? 'var(--accent)'
                  : 'var(--borderb)'
                }`,
                background: isPicked ? 'var(--green-bg)'
                  : isSelected ? 'var(--navy4)'
                  : 'var(--navy2)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all .15s',
              }}
            >
              <div style={{
                fontSize: '11px', color: 'var(--dim)',
                letterSpacing: '.5px', fontWeight: 700,
              }}>
                {isPicked ? 'YOUR PICK ✓' : isSelected ? 'SELECTED' : 'PREDICT'}
              </div>
              <div style={{
                fontSize: '13px', fontWeight: 700,
                color: 'var(--white)',
                fontFamily: "'Montserrat', sans-serif",
                textAlign: 'center',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '3px',
              }}>
                <Flag code={rr.runner?.country_code} />
                {rr.runner?.username}
              </div>
              <div style={{
                fontSize: '15px', fontWeight: 700,
                color: 'var(--white)',
              }}>
                {rr.odds ? `${rr.odds} pts` : 'TBD'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirmation panel */}
      {selectedRR && (
        <div style={{
          padding: '10px 12px',
          borderTop: '0.5px solid var(--border)',
          background: 'var(--navy2)',
        }}>
          {!loggedIn ? (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div style={{ fontSize: '14px', color: 'var(--white)', fontWeight: 700, marginBottom: '4px' }}>Login to Predict</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Sign in with Twitch to make predictions.</div>
            </div>
          ) : (
            <>
          <div style={{
            fontSize: '12px', color: 'var(--muted)',
            marginBottom: '8px', textAlign: 'center',
          }}>
            {existingPick
              ? <>{`Change pick to `}<strong style={{ color: 'var(--white)' }}>{selectedRunner?.runner?.username}</strong>{` for `}<strong style={{ color: 'var(--white)' }}>{selectedRunner?.odds}pts</strong>{` if correct`}</>
              : <>{`Predict `}<strong style={{ color: 'var(--white)' }}>{selectedRunner?.runner?.username}</strong>{` wins for `}<strong style={{ color: 'var(--white)' }}>{selectedRunner?.odds}pts</strong>{` if correct`}</>
            }
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
                background: submitting ? 'var(--navy4)' : 'var(--accent)',
                color: 'var(--bg)', border: 'none',
                fontFamily: "'Rubik', sans-serif",
                fontSize: '15px', fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase',
                cursor: submitting ? 'not-allowed' : 'pointer',
                borderRadius: '6px',
                transition: 'background .2s',
              }}
            >
              {submitting ? 'Confirming...' : existingPick ? 'Change Pick' : 'Confirm Pick'}
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
            </>
          )}
        </div>
      )}
    </div>
  )
}