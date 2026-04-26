'use client'

import { useState, useEffect, useCallback } from 'react'

interface FuturesLine {
  id: string
  runner_id: string
  line: number
  final_position: number | null
  settled_at: string | null
  runner: {
    id: string
    username: string
    current_rung: number
    seed: number | null
    status: string
  }
}

interface FuturesConfig {
  is_locked: boolean
  points_per_correct_pick: number
}

interface UserPick {
  runner_id: string
  direction: 'over' | 'under'
  is_correct: boolean | null
}

interface FuturesFeedProps {
  loggedIn: boolean
}

const REQUIRED_PICKS = 8

export default function FuturesFeed({ loggedIn }: FuturesFeedProps) {
  const [config, setConfig] = useState<FuturesConfig>({ is_locked: false, points_per_correct_pick: 100 })
  const [lines, setLines] = useState<FuturesLine[]>([])
  const [savedPicks, setSavedPicks] = useState<UserPick[]>([])
  const [draftPicks, setDraftPicks] = useState<Record<string, 'over' | 'under'>>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/ladder-futures')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setConfig(data.config)
    setLines(data.lines)
    setSavedPicks(data.picks)
    if (data.config.is_locked || data.picks.length > 0) {
      const d: Record<string, 'over' | 'under'> = {}
      for (const p of data.picks) d[p.runner_id] = p.direction
      setDraftPicks(d)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function selectPick(runner_id: string, direction: 'over' | 'under') {
    if (!loggedIn) { setShowLoginPrompt(true); return }
    if (config.is_locked) return
    if (savedPicks.length > 0) return

    setDraftPicks(prev => {
      const cur = prev[runner_id]
      // clicking the active direction → deselect
      if (cur === direction) {
        const next = { ...prev }
        delete next[runner_id]
        return next
      }
      // switching direction on an already-picked runner → allow
      if (cur) return { ...prev, [runner_id]: direction }
      // new pick — only allow if under the limit
      if (Object.keys(prev).length >= REQUIRED_PICKS) return prev
      return { ...prev, [runner_id]: direction }
    })
  }

  async function submitPicks() {
    const picks = Object.entries(draftPicks).map(([runner_id, direction]) => ({ runner_id, direction }))
    if (picks.length !== REQUIRED_PICKS) return
    setSubmitting(true)
    const res = await fetch('/api/ladder-futures/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast('Picks saved!')
      fetchData()
    } else {
      showToast(`Error: ${data.error}`)
    }
    setSubmitting(false)
  }

  const draftCount = Object.keys(draftPicks).length
  const hasSubmitted = savedPicks.length > 0
  const isEditable = loggedIn && !config.is_locked && !hasSubmitted

  const settled = lines.filter(l => l.settled_at)
  const active = lines.filter(l => !l.settled_at)

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading futures...</div>
  }

  if (lines.length === 0) {
    return (
      <div style={{ color: 'var(--dim)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>📈</div>
        <div>No futures lines set yet.</div>
      </div>
    )
  }

  function RunnerRow({ entry }: { entry: FuturesLine }) {
    const pick = draftPicks[entry.runner_id]
    const savedPick = savedPicks.find(p => p.runner_id === entry.runner_id)
    const isSettled = !!entry.settled_at

    let resultBadge: React.ReactNode = null
    if (isSettled && savedPick) {
      resultBadge = savedPick.is_correct === true
        ? <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>CORRECT +{config.points_per_correct_pick}</span>
        : <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: 'var(--red-bg)', color: 'var(--red2)', border: '1px solid var(--red-border)' }}>INCORRECT</span>
    }

    const overActive = pick === 'over'
    const underActive = pick === 'under'

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 0',
        borderBottom: '0.5px solid var(--border)',
        opacity: isSettled ? 0.7 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {entry.runner.seed != null && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--dim)', width: '22px', flexShrink: 0 }}>
              #{entry.runner.seed}
            </span>
          )}
          <div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '14px', fontWeight: 700,
              color: 'var(--white)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              {entry.runner.username}
              {resultBadge}
              {isSettled && (
                <span style={{ fontSize: '10px', color: 'var(--dim)', fontWeight: 400 }}>
                  finished {entry.final_position}
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--dim)' }}>
              O/U {entry.line}
              {savedPick && !isSettled && (
                <span style={{ marginLeft: '6px', color: savedPick.direction === 'over' ? 'var(--blue)' : 'var(--orange)', fontWeight: 700 }}>
                  · {savedPick.direction.toUpperCase()} locked in
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => isEditable && selectPick(entry.runner_id, 'over')}
            style={{
              padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
              border: '1px solid',
              borderColor: overActive ? 'var(--blue-border)' : 'var(--border)',
              background: overActive ? 'var(--blue-bg)' : 'transparent',
              color: overActive ? 'var(--blue)' : 'var(--dim)',
              cursor: isEditable ? 'pointer' : 'default',
              transition: 'all .12s',
            }}
          >
            OVER
          </button>
          <button
            onClick={() => isEditable && selectPick(entry.runner_id, 'under')}
            style={{
              padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
              border: '1px solid',
              borderColor: underActive ? 'var(--orange-border)' : 'var(--border)',
              background: underActive ? 'var(--orange-bg)' : 'transparent',
              color: underActive ? 'var(--orange)' : 'var(--dim)',
              cursor: isEditable ? 'pointer' : 'default',
              transition: 'all .12s',
            }}
          >
            UNDER
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header card */}
      <div style={{
        background: 'var(--navy2)', border: '0.5px solid var(--border)',
        borderRadius: '8px', padding: '12px 14px', marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '16px', fontWeight: 800,
            letterSpacing: '.5px', textTransform: 'uppercase',
          }}>
            Ladder Futures
          </div>
          {config.is_locked && (
            <span style={{
              fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '3px',
              background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)',
              letterSpacing: '.5px',
            }}>LOCKED</span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
          Pick over or under the line for each runner's final ladder placement (1 = best). Choose exactly {REQUIRED_PICKS} runners. Correct picks earn {config.points_per_correct_pick} pts each.
        </div>

        {/* Progress / submit */}
        {!hasSubmitted && !config.is_locked && loggedIn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '4px', background: 'var(--navy4)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                background: draftCount === REQUIRED_PICKS ? 'var(--green)' : 'var(--blue)',
                width: `${(draftCount / REQUIRED_PICKS) * 100}%`,
                transition: 'width .2s',
              }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: draftCount === REQUIRED_PICKS ? 'var(--green)' : 'var(--muted)', minWidth: '40px', textAlign: 'right' }}>
              {draftCount}/{REQUIRED_PICKS}
            </span>
            <button
              onClick={submitPicks}
              disabled={draftCount !== REQUIRED_PICKS || submitting}
              style={{
                padding: '6px 16px',
                background: draftCount === REQUIRED_PICKS ? 'var(--green)' : 'var(--navy4)',
                color: draftCount === REQUIRED_PICKS ? '#fff' : 'var(--dim)',
                border: 'none', borderRadius: '5px',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '13px', fontWeight: 800,
                cursor: draftCount === REQUIRED_PICKS && !submitting ? 'pointer' : 'not-allowed',
                transition: 'background .15s',
              }}
            >
              {submitting ? 'Saving...' : 'Submit Picks'}
            </button>
          </div>
        )}

        {hasSubmitted && !config.is_locked && (
          <div style={{ fontSize: '11px', color: 'var(--green)' }}>
            Your {REQUIRED_PICKS} picks are locked in. Results will update as runners are settled.
          </div>
        )}

        {config.is_locked && !hasSubmitted && loggedIn && (
          <div style={{ fontSize: '11px', color: 'var(--orange)' }}>
            Predictions are closed.
          </div>
        )}

      </div>

      {/* Active runners */}
      {active.length > 0 && (
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '12px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--dim)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Active
          </div>
          {active.map(entry => <RunnerRow key={entry.runner_id} entry={entry} />)}
        </div>
      )}

      {/* Settled runners */}
      {settled.length > 0 && (
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '12px 14px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--dim)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Settled
          </div>
          {settled.map(entry => <RunnerRow key={entry.runner_id} entry={entry} />)}
        </div>
      )}

      {/* Login prompt overlay */}
      {showLoginPrompt && (
        <div
          onClick={() => setShowLoginPrompt(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--navy2)', border: '0.5px solid var(--border)',
              borderRadius: '10px', padding: '28px 32px',
              textAlign: 'center', maxWidth: '320px',
            }}
          >
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
              Log in to predict
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              You need to be logged in to place a prediction.
            </div>
            <button
              onClick={() => setShowLoginPrompt(false)}
              style={{
                padding: '8px 24px', background: 'var(--red2)', color: '#fff',
                border: 'none', borderRadius: '6px',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '14px', fontWeight: 800, cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: 'var(--green-bg)', border: '1px solid var(--green-border)',
          color: 'var(--green)', padding: '10px 16px',
          borderRadius: '7px', fontSize: '13px', fontWeight: 600,
          zIndex: 200,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
