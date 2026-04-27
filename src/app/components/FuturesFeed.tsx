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
  points_earned: number | null
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
  const [lockedSection, setLockedSection] = useState<'active' | 'settled'>('active')

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/ladder-futures')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setConfig(data.config)
    setLines(data.lines)
    setSavedPicks(data.picks)
    // always seed draft from saved picks so edits are possible before lock
    const d: Record<string, 'over' | 'under'> = {}
    for (const p of data.picks) d[p.runner_id] = p.direction
    setDraftPicks(d)
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

    setDraftPicks(prev => {
      const cur = prev[runner_id]
      if (cur === direction) {
        const next = { ...prev }
        delete next[runner_id]
        return next
      }
      if (cur) return { ...prev, [runner_id]: direction }
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
  const lineMap = Object.fromEntries(lines.map(l => [l.runner_id, l]))

  if (loading) {
    return <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading placements...</div>
  }

  if (lines.length === 0) {
    return (
      <div style={{ color: 'var(--dim)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>📈</div>
        <div>No placement lines set yet.</div>
      </div>
    )
  }

  // ── LOCKED VIEW ──────────────────────────────────────────────────────────────
  if (config.is_locked) {
    if (!loggedIn || !hasSubmitted) {
      return (
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '32px', textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
            Placements
          </div>
          <span style={{
            fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '3px',
            background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)',
            letterSpacing: '.5px',
          }}>LOCKED</span>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '14px' }}>
            {!loggedIn ? 'Log in to see your picks.' : 'Predictions are closed — you did not submit picks before the deadline.'}
          </div>
        </div>
      )
    }

    const bySeed = (a: UserPick, b: UserPick) => (lineMap[a.runner_id]?.runner?.seed ?? 999) - (lineMap[b.runner_id]?.runner?.seed ?? 999)
    const activePicks = savedPicks.filter(p => !lineMap[p.runner_id]?.settled_at).sort(bySeed)
    const settledPicks = savedPicks.filter(p => lineMap[p.runner_id]?.settled_at).sort(bySeed)
    const correctCount = settledPicks.filter(p => p.is_correct === true).length
    const futuresPts = savedPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)

    const displayPicks = lockedSection === 'active' ? activePicks : settledPicks

    return (
      <div>
        {/* Header */}
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              Placements
            </div>
            <span style={{
              fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '3px',
              background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)',
              letterSpacing: '.5px',
            }}>LOCKED</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {correctCount}/{settledPicks.length} settled correct
            {futuresPts > 0 && <span style={{ color: 'var(--gold)', marginLeft: '8px' }}>+{futuresPts} pts earned</span>}
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
          <button
            onClick={() => setLockedSection('active')}
            style={{
              padding: '8px', borderRadius: '6px',
              border: `0.5px solid ${lockedSection === 'active' ? 'var(--red2)' : 'var(--border)'}`,
              background: lockedSection === 'active' ? 'var(--red-bg)' : 'var(--navy2)',
              color: lockedSection === 'active' ? 'var(--red2)' : 'var(--muted)',
              fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 800,
              letterSpacing: '.5px', textTransform: 'uppercase', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            Active
            {activePicks.length > 0 && (
              <span style={{ background: 'var(--red2)', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                {activePicks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setLockedSection('settled')}
            style={{
              padding: '8px', borderRadius: '6px',
              border: `0.5px solid ${lockedSection === 'settled' ? 'var(--green-border)' : 'var(--border)'}`,
              background: lockedSection === 'settled' ? 'var(--green-bg)' : 'var(--navy2)',
              color: lockedSection === 'settled' ? 'var(--green)' : 'var(--muted)',
              fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 800,
              letterSpacing: '.5px', textTransform: 'uppercase', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            Complete
            {settledPicks.length > 0 && (
              <span style={{ background: 'var(--green)', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                {settledPicks.length}
              </span>
            )}
          </button>
        </div>

        {/* Pick list */}
        {displayPicks.length === 0 && (
          <div style={{ color: 'var(--dim)', padding: '40px', textAlign: 'center', fontSize: '13px' }}>
            {lockedSection === 'active' ? 'All your picks have been settled.' : 'No settled picks yet.'}
          </div>
        )}

        {displayPicks.map(pick => {
          const line = lineMap[pick.runner_id]
          const won = pick.is_correct === true
          const lost = pick.is_correct === false
          return (
            <div key={pick.runner_id} style={{
              background: 'var(--navy2)',
              border: `0.5px solid ${won ? 'var(--green-border)' : lost ? 'var(--border)' : 'var(--border)'}`,
              borderRadius: '7px', padding: '10px 12px', marginBottom: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  {line?.runner?.username ?? '—'}
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px',
                    background: pick.direction === 'over' ? 'var(--blue-bg)' : 'var(--orange-bg)',
                    color: pick.direction === 'over' ? 'var(--blue)' : 'var(--orange)',
                    border: `1px solid ${pick.direction === 'over' ? 'var(--blue-border)' : 'var(--orange-border)'}`,
                  }}>
                    {pick.direction.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                  O/U {line?.line}
                  {line?.final_position && <span style={{ marginLeft: '4px' }}>· finished {line.final_position}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {lockedSection === 'active' && (
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '3px',
                    background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)',
                  }}>PENDING</span>
                )}
                {won && (
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--green)', fontFamily: "'Montserrat', sans-serif" }}>
                      +{pick.points_earned ?? 0}pts
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--dim)' }}>Correct</div>
                  </div>
                )}
                {lost && (
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--red2)', fontFamily: "'Montserrat', sans-serif" }}>
                      +0pts
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--dim)' }}>Incorrect</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── PRE-LOCK VIEW ─────────────────────────────────────────────────────────────
  function RunnerRow({ entry }: { entry: FuturesLine }) {
    const pick = draftPicks[entry.runner_id]
    const overActive = pick === 'over'
    const underActive = pick === 'under'
    const isEditable = loggedIn

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 0', borderBottom: '0.5px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {entry.runner.seed != null && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--dim)', width: '22px', flexShrink: 0 }}>
              #{entry.runner.seed}
            </span>
          )}
          <div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 700, color: 'var(--white)' }}>
              {entry.runner.username}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--dim)' }}>O/U {entry.line}</div>
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
        <div style={{ marginBottom: '4px', fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase' }}>
          Placements
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
          Pick over or under the line for each runner's final ladder placement (1 = best). Choose exactly {REQUIRED_PICKS} runners. Correct picks earn {config.points_per_correct_pick} pts each.
        </div>

        {loggedIn && (
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
              {submitting ? 'Saving...' : hasSubmitted ? 'Update Picks' : 'Submit Picks'}
            </button>
          </div>
        )}
      </div>

      {/* All runners */}
      <div style={{
        background: 'var(--navy2)', border: '0.5px solid var(--border)',
        borderRadius: '8px', padding: '12px 14px',
      }}>
        {lines.map(entry => <RunnerRow key={entry.runner_id} entry={entry} />)}
      </div>

      {/* Login prompt */}
      {showLoginPrompt && (
        <div
          onClick={() => setShowLoginPrompt(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--navy2)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '28px 32px', textAlign: 'center', maxWidth: '320px' }}
          >
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>Log in to predict</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>You need to be logged in to place a prediction.</div>
            <button
              onClick={() => setShowLoginPrompt(false)}
              style={{ padding: '8px 24px', background: 'var(--red2)', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
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
          borderRadius: '7px', fontSize: '13px', fontWeight: 600, zIndex: 200,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
