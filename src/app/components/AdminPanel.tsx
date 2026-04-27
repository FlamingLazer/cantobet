'use client'

import { useState, useEffect } from 'react'

const TBD_SENTINEL = '9999-12-31T23:59:59.000Z'
const isTBD = (s: string) => s?.startsWith('9999')
import { createClient } from '@/lib/supabase'
import ProfileModal from './ProfileModal'

interface Runner {
  id: string
  username: string
  current_rung: number
  seed: number | null
}

interface RaceRow {
  id: string
  week: number
  rung: number
  stage: string | null
  scheduled_at: string
  status: 'open' | 'locked' | 'settled'
  race_runners: {
    id: string
    odds: number | null
    finish_position: number | null
    runner: { username: string } | null
  }[]
}

interface AuditEntry {
  id: string
  action_type: string
  description: string
  created_at: string
  admin: { twitch_username: string } | null
}

interface UserRow {
  id: string
  twitch_username: string
  points: number
  is_admin: boolean
  created_at: string
}

interface FuturesRunner {
  id: string
  username: string
  seed: number | null
  status: string
  line: FuturesLine | null
}

interface FuturesLine {
  runner_id: string
  line: number
  final_position: number | null
  settled_at: string | null
}

interface FuturesConfig {
  is_locked: boolean
  points_per_correct_pick: number
}

export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<'races' | 'settle' | 'users' | 'futures' | 'audit'>('races')
  const [runners, setRunners] = useState<Runner[]>([])
  const [races, setRaces] = useState<RaceRow[]>([])
  const [settledRaces, setSettledRaces] = useState<RaceRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [auditFilter, setAuditFilter] = useState('')
  const [auditType, setAuditType] = useState('')
  const [settleRaceId, setSettleRaceId] = useState<string | null>(null)
  const [settleResults, setSettleResults] = useState<Record<string, { time: string; position: number }>>({})
  const [settling, setSettling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<{ id: string; username: string } | null>(null)
  const [editRaceId, setEditRaceId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editOdds, setEditOdds] = useState<Record<string, string>>({})

  const [futuresConfig, setFuturesConfig] = useState<FuturesConfig>({ is_locked: false, points_per_correct_pick: 100 })
  const [futuresRunners, setFuturesRunners] = useState<FuturesRunner[]>([])
  const [futuresLines, setFuturesLines] = useState<Record<string, string>>({})
  const [futuresPositions, setFuturesPositions] = useState<Record<string, string>>({})
  const [futuresPtsInput, setFuturesPtsInput] = useState('')
  const [settlingFutures, setSettlingFutures] = useState<string | null>(null)
  const [unsettlingFutures, setUnsettlingFutures] = useState<string | null>(null)

  const [newWeek, setNewWeek] = useState(1)
  const [newRung, setNewRung] = useState(1)
  const [newTime, setNewTime] = useState('')
  const [newTBD, setNewTBD] = useState(false)
  const [newFormat, setNewFormat] = useState<2 | 3>(3)
  const [newStage, setNewStage] = useState('')
  const [editTBD, setEditTBD] = useState(false)

  const stageOptions = [
    'Wildcard Match',
    'Quarterfinal 1', 'Quarterfinal 2', 'Quarterfinal 3', 'Quarterfinal 4',
    'Semifinal 1', 'Semifinal 2',
    '3rd Place Match',
    'Grand Finals',
  ]
  const [newRunners, setNewRunners] = useState<{ runner_id: string; odds: string }[]>([
    { runner_id: '', odds: '' },
    { runner_id: '', odds: '' },
    { runner_id: '', odds: '' },
  ])
  const [creating, setCreating] = useState(false)
  const [seedingRunners, setSeedingRunners] = useState(false)

  const [adjUsername, setAdjUsername] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchRunners()
    fetchRaces()
    fetchSettledRaces()
    fetchUsers()
    fetchAudit()
    fetchFutures()
  }, [])

  async function saveRaceEdit() {
    if (!editRaceId) return

    const res = await fetch(`/api/races/${editRaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at: editTBD ? TBD_SENTINEL : editTime ? new Date(editTime).toISOString() : undefined,
        odds: editOdds,
      }),
    })

    if (res.ok) {
      showToast('Race updated!')
      setEditRaceId(null)
      setEditTime('')
      setEditOdds({})
      fetchRaces()
    } else {
      const data = await res.json()
      showToast(`Error: ${data.error}`)
    }
  }

  async function fetchRunners() {
    const { data } = await supabase
      .from('runners')
      .select('id, username, current_rung, seed')
      .neq('status', 'eliminated')
      .order('seed')
    setRunners((data as Runner[]) ?? [])
  }

  async function fetchRaces() {
    const { data } = await supabase
      .from('races')
      .select(`
        id, week, rung, stage, scheduled_at, status,
        race_runners(id, odds, finish_position, runner:runners(username))
      `)
      .neq('status', 'settled')
      .order('scheduled_at')
    setRaces((data as unknown as RaceRow[]) ?? [])
  }

  async function fetchSettledRaces() {
    const { data } = await supabase
      .from('races')
      .select(`
        id, week, rung, stage, scheduled_at, status,
        race_runners(id, odds, finish_position, runner:runners(username))
      `)
      .eq('status', 'settled')
      .order('scheduled_at', { ascending: false })
      .limit(10)
    setSettledRaces((data as unknown as RaceRow[]) ?? [])
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, twitch_username, points, is_admin, created_at')
      .order('points', { ascending: false })
    setUsers((data as UserRow[]) ?? [])
  }

  async function fetchAudit() {
    const { data } = await supabase
      .from('audit_log')
      .select('id, action_type, description, created_at, admin:users(twitch_username)')
      .order('created_at', { ascending: false })
      .limit(100)
    setAuditLog((data as unknown as AuditEntry[]) ?? [])
  }

  async function fetchFutures() {
    const [res, runnersResult] = await Promise.all([
      fetch('/api/ladder-futures'),
      supabase.from('runners').select('id, username, seed, status').order('seed'),
    ])
    if (!res.ok) return
    const data = await res.json()
    setFuturesConfig(data.config)
    setFuturesPtsInput(String(data.config.points_per_correct_pick))

    const { data: allRunners } = runnersResult

    const lineMap: Record<string, FuturesLine> = {}
    for (const l of (data.lines as FuturesLine[])) lineMap[l.runner_id] = l

    const combined: FuturesRunner[] = ((allRunners ?? []) as { id: string; username: string; seed: number | null; status: string }[]).map(r => ({
      ...r,
      line: lineMap[r.id] ?? null,
    }))
    setFuturesRunners(combined)

    const initLines: Record<string, string> = {}
    for (const l of (data.lines as FuturesLine[])) initLines[l.runner_id] = String(l.line)
    setFuturesLines(initLines)
  }

  async function saveFuturesLine(runner_id: string) {
    const lineVal = parseFloat(futuresLines[runner_id] ?? '')
    if (isNaN(lineVal)) { showToast('Enter a valid line'); return }
    const res = await fetch('/api/admin/ladder-futures/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runner_id, line: lineVal }),
    })
    if (res.ok) { showToast('Line saved'); fetchFutures() }
    else { const d = await res.json(); showToast(`Error: ${d.error}`) }
  }

  async function saveFuturesConfig(patch: Partial<FuturesConfig>) {
    const res = await fetch('/api/admin/ladder-futures/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) { showToast('Config saved'); fetchFutures() }
    else { const d = await res.json(); showToast(`Error: ${d.error}`) }
  }

  async function unsettleFutures(runner_id: string) {
    setUnsettlingFutures(runner_id)
    const res = await fetch('/api/admin/ladder-futures/unsettle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runner_id }),
    })
    const d = await res.json()
    if (res.ok) { showToast(`Unsettled — ${d.reversals} pick${d.reversals !== 1 ? 's' : ''} reversed`); fetchFutures(); fetchAudit() }
    else showToast(`Error: ${d.error}`)
    setUnsettlingFutures(null)
  }

  async function settleFutures(runner_id: string) {
    const pos = parseInt(futuresPositions[runner_id] ?? '')
    if (isNaN(pos) || pos < 1 || pos > 21) { showToast('Enter position 1–21'); return }
    setSettlingFutures(runner_id)
    const res = await fetch('/api/admin/ladder-futures/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runner_id, final_position: pos }),
    })
    const d = await res.json()
    if (res.ok) { showToast(`Settled! ${d.winners}/${d.total} correct`); fetchFutures(); fetchAudit() }
    else showToast(`Error: ${d.error}`)
    setSettlingFutures(null)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function createRace() {
    if ((!newTBD && !newTime) || newRunners.some(r => !r.runner_id)) return
    if (newFormat === 2 && !newStage) { showToast('Select a stage'); return }
    setCreating(true)
    const res = await fetch('/api/races', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week: newFormat === 3 ? newWeek : undefined,
        rung: newFormat === 3 ? newRung : undefined,
        scheduled_at: newTBD ? TBD_SENTINEL : new Date(newTime).toISOString(),
        is_top8_qualifier: newFormat === 2 || newRung === 1,
        stage: newFormat === 2 ? newStage : undefined,
        runners: newRunners.map(r => ({
          runner_id: r.runner_id,
          odds: parseFloat(r.odds) || null,
        })),
      }),
    })
    if (res.ok) {
      showToast('Race created!')
      fetchRaces()
      setNewTime('')
      setNewTBD(false)
      setNewStage('')
      setNewRunners(Array.from({ length: newFormat }, () => ({ runner_id: '', odds: '' })))
    } else {
      const d = await res.json()
      showToast(`Error: ${d.error}`)
    }
    setCreating(false)
  }

  async function deleteRace(raceId: string) {
    const res = await fetch(`/api/races/${raceId}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Race deleted')
      fetchRaces()
      fetchAudit()
    } else {
      const data = await res.json()
      showToast(`Error: ${data.error}`)
    }
  }

  async function settleRace() {
    if (!settleRaceId) return
    const race = races.find(r => r.id === settleRaceId)
    if (!race) return

    const results = race.race_runners.map(rr => ({
      race_runner_id: rr.id,
      finish_position: settleResults[rr.id]?.position ?? 0,
      finish_time: settleResults[rr.id]?.time ?? '',
    }))

    if (results.some(r => !r.finish_position || !r.finish_time)) {
      showToast('Please fill in all times and positions')
      return
    }

    setSettling(true)
    const res = await fetch('/api/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ race_id: settleRaceId, results }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`Settled! ${data.winners} winners paid out.`)
      setSettleRaceId(null)
      setSettleResults({})
      fetchRaces()
      fetchSettledRaces()
      fetchAudit()
    } else {
      showToast(`Error: ${data.error}`)
    }
    setSettling(false)
  }

  async function unsettleRace(raceId: string) {
    const res = await fetch('/api/unsettle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ race_id: raceId }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`Unsettled — ${data.reversals} bet${data.reversals !== 1 ? 's' : ''} reversed`)
      fetchRaces()
      fetchSettledRaces()
      fetchAudit()
    } else {
      showToast(`Error: ${data.error}`)
    }
  }

  async function lockRace(raceId: string) {
    const res = await fetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'locked' }),
    })
    if (res.ok) {
      showToast('Race locked — predictions closed')
      fetchRaces()
      fetchAudit()
    } else {
      const data = await res.json()
      showToast(`Error: ${data.error}`)
    }
  }

  async function unlockRace(raceId: string) {
    const res = await fetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    })
    if (res.ok) {
      showToast('Race unlocked — predictions reopened')
      fetchRaces()
      fetchAudit()
    } else {
      const data = await res.json()
      showToast(`Error: ${data.error}`)
    }
  }

  async function toggleAdmin(userId: string, current: boolean) {
    const res = await fetch('/api/admin/toggle-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_admin: !current }),
    })
    if (res.ok) {
      fetchUsers()
      fetchAudit()
      showToast(`Admin access ${!current ? 'granted' : 'removed'}`)
    } else {
      const data = await res.json()
      showToast(`Error: ${data.error}`)
    }
  }

  async function applyStudsAdjustment() {
    const user = users.find(u => u.twitch_username.toLowerCase() === adjUsername.toLowerCase())
    if (!user) { showToast('User not found'); return }
    const amount = parseInt(adjAmount)
    if (!amount || !adjReason) { showToast('Fill in all fields'); return }

    setAdjusting(true)
    const res = await fetch('/api/admin/adjust-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, amount, reason: adjReason }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`Done! New points total: ${data.new_balance.toLocaleString()}`)
      setAdjUsername('')
      setAdjAmount('')
      setAdjReason('')
      fetchUsers()
      fetchAudit()
    } else {
      showToast(`Error: ${data.error}`)
    }
    setAdjusting(false)
  }

  const filteredAudit = auditLog.filter(e => {
    const matchesText = !auditFilter ||
      e.description.toLowerCase().includes(auditFilter.toLowerCase()) ||
      (e.admin?.twitch_username ?? '').toLowerCase().includes(auditFilter.toLowerCase())
    const matchesType = !auditType || e.action_type === auditType
    return matchesText && matchesType
  })

  const sectionBtn = (id: typeof activeSection, label: string) => (
    <button
      onClick={() => setActiveSection(id)}
      style={{
        padding: '7px 14px',
        background: activeSection === id ? 'var(--navy4)' : 'transparent',
        color: activeSection === id ? 'var(--white)' : 'var(--muted)',
        border: '0.5px solid',
        borderColor: activeSection === id ? 'var(--borderb)' : 'var(--border)',
        borderRadius: '5px',
        fontSize: '12px', fontWeight: 700,
        fontFamily: "'Montserrat', sans-serif",
        letterSpacing: '.5px', textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 800,
          padding: '3px 10px', borderRadius: '3px',
          background: 'var(--orange-bg)', color: 'var(--orange)',
          border: '1px solid var(--orange-border)',
          letterSpacing: '.8px',
        }}>ADMIN PANEL</div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {sectionBtn('races', 'Create Race')}
        {sectionBtn('settle', 'Settle Races')}
        {sectionBtn('futures', 'Placements')}
        {sectionBtn('users', 'Users')}
        {sectionBtn('audit', 'Audit Log')}
      </div>

      {/* CREATE RACE */}
      {activeSection === 'races' && (
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '14px',
        }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '15px', fontWeight: 800, marginBottom: '12px',
          }}>Create Race</div>

          <div className="admin-create-grid">
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Format</div>
              <select value={newFormat} onChange={e => {
                const f = Number(e.target.value) as 2 | 3
                setNewFormat(f)
                setNewStage('')
                setNewRunners(Array.from({ length: f }, () => ({ runner_id: '', odds: '' })))
              }}
                style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}>
                <option value={3}>1v1v1</option>
                <option value={2}>1v1</option>
              </select>
            </div>

            {newFormat === 3 ? (
              <>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Week</div>
                  <input type="number" value={newWeek} min={1} onChange={e => setNewWeek(Number(e.target.value))}
                    style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Rung</div>
                  <select value={newRung} onChange={e => setNewRung(Number(e.target.value))}
                    style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}>
                    {[1,2,3,4,5,6,7].map(r => (
                      <option key={r} value={r}>Rung {r}{r === 1 ? ' — Qualifies' : r === 7 ? ' — Elim zone' : ''}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Stage</div>
                <select value={newStage} onChange={e => setNewStage(e.target.value)}
                  style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}>
                  <option value="">Select stage</option>
                  {stageOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Scheduled time</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={newTBD} onChange={e => setNewTBD(e.target.checked)} />
                TBD
              </label>
            </div>
            <input type="datetime-local" value={newTime} onChange={e => setNewTime(e.target.value)}
              disabled={newTBD}
              style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: newTBD ? 'var(--dim)' : 'var(--white)', fontSize: '13px', outline: 'none', opacity: newTBD ? 0.4 : 1 }} />
          </div>

          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase' }}>
            Runners & Odds
          </div>
          {newRunners.map((nr, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px', marginBottom: '6px' }}>
              <select
                value={nr.runner_id}
                onChange={e => {
                  const updated = [...newRunners]
                  updated[i] = { ...updated[i], runner_id: e.target.value }
                  setNewRunners(updated)
                }}
                style={{ background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
              >
                <option value="">Select runner {i + 1}</option>
                {runners.map(r => (
                  <option key={r.id} value={r.id}>{r.username}{r.seed != null ? ` (Seed ${r.seed})` : ''}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Odds e.g. 1.80"
                value={nr.odds}
                step={0.05} min={1}
                onChange={e => {
                  const updated = [...newRunners]
                  updated[i] = { ...updated[i], odds: e.target.value }
                  setNewRunners(updated)
                }}
                style={{ background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
              />
            </div>
          ))}

          <button
            onClick={createRace}
            disabled={creating}
            style={{
              width: '100%', marginTop: '6px', padding: '10px',
              background: creating ? 'var(--navy4)' : 'var(--orange)',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '15px', fontWeight: 800,
              letterSpacing: '.5px', textTransform: 'uppercase',
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creating...' : 'Create Race'}
          </button>
        </div>
      )}

      {/* SETTLE RACES */}
      {activeSection === 'settle' && (
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '14px',
        }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '15px', fontWeight: 800, marginBottom: '12px',
          }}>Settle Races</div>

          {races.length === 0 && (
            <div style={{ color: 'var(--dim)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
              No open or locked races.
            </div>
          )}

          {races.map(race => (
            <div key={race.id} style={{
              background: 'var(--navy3)', border: '0.5px solid var(--border)',
              borderRadius: '6px', padding: '10px 12px', marginBottom: '8px',
            }}>
              <div className="admin-race-header" style={{ marginBottom: (settleRaceId === race.id || editRaceId === race.id) ? '10px' : '0' }}>
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 800 }}>
                    {race.stage ?? `W${race.week} · Rung ${race.rung}`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {race.race_runners.map(rr => rr.runner?.username).join(' · ')}
                  </div>
                </div>
                <div className="admin-race-actions">
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    padding: '2px 7px', borderRadius: '10px',
                    background: race.status === 'locked' ? 'var(--orange-bg)' : 'var(--blue-bg)',
                    color: race.status === 'locked' ? 'var(--orange)' : 'var(--blue)',
                    border: `1px solid ${race.status === 'locked' ? 'var(--orange-border)' : 'var(--blue-border)'}`,
                  }}>
                    {race.status.toUpperCase()}
                  </span>

                  {/* Lock button — only for open races */}
                  {race.status === 'open' && (
                    <button
                      onClick={() => lockRace(race.id)}
                      style={{ padding: '5px 10px', background: 'var(--orange-bg)', color: 'var(--orange)', border: '0.5px solid var(--orange-border)', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Lock
                    </button>
                  )}

                  {/* Unlock button — only for locked races */}
                  {race.status === 'locked' && (
                    <button
                      onClick={() => unlockRace(race.id)}
                      style={{ padding: '5px 10px', background: 'var(--gold-bg)', color: 'var(--gold)', border: '0.5px solid var(--gold-dim)', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Unlock
                    </button>
                  )}

                  {/* Settle button */}
                  {settleRaceId === race.id ? (
                    <button
                      onClick={() => setSettleRaceId(null)}
                      style={{ padding: '5px 10px', background: 'transparent', color: 'var(--muted)', border: '0.5px solid var(--border)', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSettleRaceId(race.id); setEditRaceId(null) }}
                      style={{ padding: '5px 10px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Settle
                    </button>
                  )}

                  {/* Edit button */}
                  {editRaceId === race.id ? (
                    <button
                      onClick={() => { setEditRaceId(null); setEditTime(''); setEditTBD(false); setEditOdds({}) }}
                      style={{ padding: '5px 10px', background: 'transparent', color: 'var(--muted)', border: '0.5px solid var(--border)', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditRaceId(race.id)
                        setSettleRaceId(null)
                        if (isTBD(race.scheduled_at)) {
                          setEditTBD(true)
                          setEditTime('')
                        } else {
                          setEditTBD(false)
                          const scheduledDate = new Date(race.scheduled_at)
                          scheduledDate.setMinutes(scheduledDate.getMinutes() - scheduledDate.getTimezoneOffset())
                          setEditTime(scheduledDate.toISOString().slice(0, 16))
                        }
                        const initialOdds: Record<string, string> = {}
                        race.race_runners.forEach(rr => {
                          initialOdds[rr.id] = rr.odds?.toString() ?? ''
                        })
                        setEditOdds(initialOdds)
                      }}
                      style={{ padding: '5px 10px', background: 'var(--blue-bg)', color: 'var(--blue)', border: '0.5px solid var(--blue-border)', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => deleteRace(race.id)}
                    style={{ padding: '5px 10px', background: 'var(--red-bg)', color: 'var(--red2)', border: '0.5px solid var(--red-border)', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Settle form */}
              {settleRaceId === race.id && (
                <div>
                  {race.race_runners.map(rr => (
                    <div key={rr.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 700 }}>
                        {rr.runner?.username}
                      </div>
                      <input
                        type="text"
                        placeholder="2:XX:XX"
                        value={settleResults[rr.id]?.time ?? ''}
                        onChange={e => setSettleResults(prev => ({ ...prev, [rr.id]: { ...prev[rr.id], time: e.target.value } }))}
                        style={{ background: 'var(--navy2)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '6px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
                      />
                      <select
                        value={settleResults[rr.id]?.position ?? ''}
                        onChange={e => setSettleResults(prev => ({ ...prev, [rr.id]: { ...prev[rr.id], position: Number(e.target.value) } }))}
                        style={{ background: 'var(--navy2)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '6px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
                      >
                        <option value="">Place</option>
                        <option value="1">1st</option>
                        <option value="2">2nd</option>
                        <option value="3">3rd</option>
                      </select>
                    </div>
                  ))}
                  <button
                    onClick={settleRace}
                    disabled={settling}
                    style={{
                      width: '100%', padding: '9px',
                      background: settling ? 'var(--navy4)' : 'var(--green)',
                      color: '#fff', border: 'none', borderRadius: '5px',
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: '15px', fontWeight: 800,
                      letterSpacing: '.5px', cursor: settling ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {settling ? 'Settling...' : 'Confirm & Pay Out'}
                  </button>
                </div>
              )}

              {/* Edit form */}
              {editRaceId === race.id && (
                <div style={{ paddingTop: '10px', borderTop: '0.5px solid var(--border)' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Scheduled time</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editTBD} onChange={e => setEditTBD(e.target.checked)} />
                        TBD
                      </label>
                    </div>
                    <input
                      type="datetime-local"
                      value={editTime}
                      onChange={e => setEditTime(e.target.value)}
                      disabled={editTBD}
                      style={{ width: '100%', background: 'var(--navy2)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '6px 10px', color: editTBD ? 'var(--dim)' : 'var(--white)', fontSize: '13px', outline: 'none', opacity: editTBD ? 0.4 : 1 }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase' }}>
                    Odds
                  </div>
                  {race.race_runners.map(rr => (
                    <div key={rr.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 700 }}>
                        {rr.runner?.username}
                      </div>
                      <input
                        type="number"
                        placeholder="e.g. 1.80"
                        value={editOdds[rr.id] ?? ''}
                        step={0.05} min={1}
                        onChange={e => setEditOdds(prev => ({ ...prev, [rr.id]: e.target.value }))}
                        style={{ background: 'var(--navy2)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '6px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={saveRaceEdit}
                    style={{
                      width: '100%', padding: '8px',
                      background: 'var(--blue)', color: '#fff',
                      border: 'none', borderRadius: '5px',
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: '14px', fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          ))}

          {settledRaces.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 700,
                letterSpacing: '1px', textTransform: 'uppercase',
                color: 'var(--dim)', marginBottom: '8px',
              }}>
                Recently Settled
              </div>
              {settledRaces.map(race => (
                <div key={race.id} style={{
                  background: 'var(--navy3)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: 0.8,
                }}>
                  <div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 800 }}>
                      {race.stage ?? `W${race.week} · Rung ${race.rung}`}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {race.race_runners.map(rr => rr.runner?.username).join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => unsettleRace(race.id)}
                    style={{
                      padding: '5px 10px',
                      background: 'var(--orange-bg)',
                      color: 'var(--orange)',
                      border: '0.5px solid var(--orange-border)',
                      borderRadius: '5px',
                      fontSize: '12px', fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Unsettle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FUTURES */}
      {activeSection === 'futures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Config */}
          <div style={{ background: 'var(--navy2)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>
              Placements Config
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Points per correct pick</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number" min={1}
                    value={futuresPtsInput}
                    onChange={e => setFuturesPtsInput(e.target.value)}
                    style={{ flex: 1, background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    onClick={() => saveFuturesConfig({ points_per_correct_pick: parseInt(futuresPtsInput) })}
                    style={{ padding: '7px 12px', background: 'var(--blue-bg)', color: 'var(--blue)', border: '0.5px solid var(--blue-border)', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Predictions</div>
                <button
                  onClick={() => saveFuturesConfig({ is_locked: !futuresConfig.is_locked })}
                  style={{
                    padding: '7px 16px',
                    background: futuresConfig.is_locked ? 'var(--green-bg)' : 'var(--orange-bg)',
                    color: futuresConfig.is_locked ? 'var(--green)' : 'var(--orange)',
                    border: `0.5px solid ${futuresConfig.is_locked ? 'var(--green-border)' : 'var(--orange-border)'}`,
                    borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {futuresConfig.is_locked ? 'Unlock Picks' : 'Lock Picks'}
                </button>
              </div>
            </div>
          </div>

          {/* Lines + settle */}
          <div style={{ background: 'var(--navy2)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>
              Runner Lines
            </div>
            <div className="admin-placements-scroll">
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px 130px 90px',
              gap: '8px', padding: '0 0 6px',
              borderBottom: '0.5px solid var(--border)',
              fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
              letterSpacing: '.5px', textTransform: 'uppercase',
              minWidth: '440px',
            }}>
              <span>Runner</span><span>Line</span><span>Final Pos</span><span>Status</span>
            </div>
            {futuresRunners.map(r => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px 130px 90px',
                gap: '8px', alignItems: 'center',
                padding: '7px 0', borderBottom: '0.5px solid var(--border)',
                opacity: r.line?.settled_at ? 0.6 : 1,
                minWidth: '440px',
              }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.seed != null ? `#${r.seed} ` : ''}{r.username}
                </span>

                {/* Line input */}
                {r.line?.settled_at ? (
                  <span style={{ fontSize: '13px', color: 'var(--dim)' }}>
                    {r.line.line}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number" step={0.5} min={0.5} placeholder="14.5"
                      value={futuresLines[r.id] ?? ''}
                      onChange={e => setFuturesLines(prev => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ width: '70px', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '5px 8px', color: 'var(--white)', fontSize: '12px', outline: 'none' }}
                    />
                    <button
                      onClick={() => saveFuturesLine(r.id)}
                      style={{ padding: '4px 8px', background: 'var(--blue-bg)', color: 'var(--blue)', border: '0.5px solid var(--blue-border)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Set
                    </button>
                  </div>
                )}

                {/* Settle input */}
                {r.line?.settled_at ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 700 }}>
                      {r.line.final_position}
                    </span>
                    <button
                      onClick={() => unsettleFutures(r.id)}
                      disabled={unsettlingFutures === r.id}
                      style={{ padding: '3px 7px', background: 'var(--orange-bg)', color: 'var(--orange)', border: '0.5px solid var(--orange-border)', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {unsettlingFutures === r.id ? '...' : 'Unsettle'}
                    </button>
                  </div>
                ) : r.line ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number" min={1} max={21} placeholder="1–21"
                      value={futuresPositions[r.id] ?? ''}
                      onChange={e => setFuturesPositions(prev => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ width: '55px', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '5px 8px', color: 'var(--white)', fontSize: '12px', outline: 'none' }}
                    />
                    <button
                      onClick={() => settleFutures(r.id)}
                      disabled={settlingFutures === r.id}
                      style={{ padding: '4px 8px', background: 'var(--green-bg)', color: 'var(--green)', border: '0.5px solid var(--green-border)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {settlingFutures === r.id ? '...' : 'Settle'}
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--dim)' }}>set line first</span>
                )}

                <span style={{
                  fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '3px',
                  background: r.line?.settled_at ? 'var(--green-bg)' : r.line ? 'var(--blue-bg)' : 'var(--navy4)',
                  color: r.line?.settled_at ? 'var(--green)' : r.line ? 'var(--blue)' : 'var(--dim)',
                  border: `1px solid ${r.line?.settled_at ? 'var(--green-border)' : r.line ? 'var(--blue-border)' : 'var(--border)'}`,
                  textAlign: 'center',
                }}>
                  {r.line?.settled_at ? 'SETTLED' : r.line ? 'LINE SET' : 'NO LINE'}
                </span>
              </div>
            ))}
            </div>{/* end admin-placements-scroll */}
          </div>
        </div>
      )}

      {/* USERS */}
      {activeSection === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            background: 'var(--navy2)', border: '0.5px solid var(--border)',
            borderRadius: '8px', padding: '14px',
          }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>
              Users
            </div>
            <div className="admin-placements-scroll">
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 100px 60px',
              gap: '8px', padding: '0 0 6px',
              borderBottom: '0.5px solid var(--border)',
              fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
              letterSpacing: '.5px', textTransform: 'uppercase',
              minWidth: '380px',
            }}>
              <span>Username</span>
              <span style={{ textAlign: 'right' }}>Balance</span>
              <span style={{ textAlign: 'right' }}>Joined</span>
              <span style={{ textAlign: 'center' }}>Admin</span>
            </div>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 100px 60px',
                gap: '8px', alignItems: 'center',
                padding: '7px 0', borderBottom: '0.5px solid var(--border)',
                fontSize: '12px', minWidth: '380px',
              }}>
                <span
                  onClick={() => setViewingUser({ id: u.id, username: u.twitch_username })}
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', color: 'var(--white)',
                    textDecoration: 'underline',
                    textDecorationColor: 'var(--border)',
                    textUnderlineOffset: '3px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {u.twitch_username}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
                  {u.points.toLocaleString()}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--dim)', fontSize: '11px' }}>
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => toggleAdmin(u.id, u.is_admin)}
                    style={{
                      width: '36px', height: '20px',
                      borderRadius: '10px', border: 'none',
                      background: u.is_admin ? 'var(--orange)' : 'var(--navy4)',
                      cursor: 'pointer', position: 'relative',
                      transition: 'background .2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      width: '14px', height: '14px',
                      borderRadius: '50%', background: '#fff',
                      top: '3px',
                      left: u.is_admin ? '19px' : '3px',
                      transition: 'left .2s',
                    }} />
                  </button>
                </div>
              </div>
            ))}
            </div>{/* end admin-placements-scroll */}
          </div>

          <div style={{
            background: 'var(--navy2)', border: '0.5px solid var(--border)',
            borderRadius: '8px', padding: '14px',
          }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>
              Manual Points Adjustment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Username</div>
                <input
                  type="text" placeholder="twitch_username"
                  value={adjUsername} onChange={e => setAdjUsername(e.target.value)}
                  style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Amount (use − to deduct)</div>
                <input
                  type="number" placeholder="e.g. 500 or -200"
                  value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
                  style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Reason</div>
              <input
                type="text" placeholder="e.g. Payout correction W1 R1"
                value={adjReason} onChange={e => setAdjReason(e.target.value)}
                style={{ width: '100%', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '7px 10px', color: 'var(--white)', fontSize: '13px', outline: 'none' }}
              />
            </div>
            <button
              onClick={applyStudsAdjustment}
              disabled={adjusting}
              style={{
                width: '100%', padding: '9px',
                background: 'transparent', color: 'var(--orange)',
                border: '0.5px solid var(--orange-border)', borderRadius: '5px',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '14px', fontWeight: 800,
                cursor: adjusting ? 'not-allowed' : 'pointer',
              }}
            >
              {adjusting ? 'Applying...' : 'Apply Adjustment'}
            </button>
          </div>
        </div>
      )}

      {/* AUDIT LOG */}
      {activeSection === 'audit' && (
        <div style={{
          background: 'var(--navy2)', border: '0.5px solid var(--border)',
          borderRadius: '8px', padding: '14px',
        }}>
          <div className="admin-audit-header" style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '12px', gap: '8px',
          }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '15px', fontWeight: 800 }}>
              Audit Log
            </div>
            <div className="admin-audit-filters" style={{ display: 'flex', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
              <input
                type="text" placeholder="Search..."
                value={auditFilter} onChange={e => setAuditFilter(e.target.value)}
                style={{ width: '180px', background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '5px 10px', color: 'var(--white)', fontSize: '12px', outline: 'none' }}
              />
              <select
                value={auditType} onChange={e => setAuditType(e.target.value)}
                style={{ background: 'var(--navy3)', border: '0.5px solid var(--borderb)', borderRadius: '5px', padding: '5px 10px', color: 'var(--white)', fontSize: '12px', outline: 'none' }}
              >
                <option value="">All types</option>
                <option value="race_created">Race created</option>
                <option value="race_settled">Settlement</option>
                <option value="race_deleted">Deleted</option>
                <option value="odds_updated">Odds</option>
                <option value="studs_adjusted">Points</option>
                <option value="admin_granted">User</option>
              </select>
            </div>
          </div>

          <div className="admin-placements-scroll">
          <div style={{
            display: 'grid', gridTemplateColumns: '120px 110px minmax(0, 1fr) 100px',
            gap: '8px', padding: '0 0 6px',
            borderBottom: '0.5px solid var(--border)',
            fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
            letterSpacing: '.5px', textTransform: 'uppercase',
            minWidth: '440px',
          }}>
            <span>Time</span><span>Admin</span><span>Action</span><span>Type</span>
          </div>

          {filteredAudit.length === 0 && (
            <div style={{ color: 'var(--dim)', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
              No entries found.
            </div>
          )}

          {filteredAudit.map(entry => {
            const tagColors: Record<string, { bg: string; color: string; border: string }> = {
              race_created:   { bg: 'var(--blue-bg)',   color: 'var(--blue)',   border: 'var(--blue-border)' },
              race_settled:   { bg: 'var(--green-bg)',  color: 'var(--green)',  border: 'var(--green-border)' },
              race_deleted:   { bg: 'var(--red-bg)',    color: 'var(--red2)',   border: 'var(--red-border)' },
              odds_updated:   { bg: 'var(--orange-bg)', color: 'var(--orange)', border: 'var(--orange-border)' },
              studs_adjusted: { bg: 'var(--gold-bg)',   color: 'var(--gold)',   border: 'var(--gold-dim)' },
              admin_granted:  { bg: 'var(--navy4)',     color: 'var(--muted)',  border: 'var(--border)' },
              admin_revoked:  { bg: 'var(--navy4)',     color: 'var(--muted)',  border: 'var(--border)' },
            }
            const tag = tagColors[entry.action_type] ?? tagColors.admin_granted

            return (
              <div key={entry.id} style={{
                display: 'grid', gridTemplateColumns: '120px 110px minmax(0, 1fr) 100px',
                gap: '8px', alignItems: 'baseline',
                padding: '7px 0', borderBottom: '0.5px solid var(--border)',
                fontSize: '12px', minWidth: '440px',
              }}>
                <span style={{ fontSize: '11px', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(entry.created_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: 700 }}>
                  {entry.admin?.twitch_username ?? '—'}
                </span>
                <span style={{ color: 'var(--muted)', lineHeight: 1.4 }}>
                  {entry.description}
                </span>
                <span style={{
                  fontSize: '9px', fontWeight: 800,
                  padding: '2px 7px', borderRadius: '3px',
                  background: tag.bg, color: tag.color,
                  border: `1px solid ${tag.border}`,
                  letterSpacing: '.5px', textAlign: 'center',
                  textTransform: 'uppercase',
                }}>
                  {entry.action_type.replace('_', ' ')}
                </span>
              </div>
            )
          })}
          </div>{/* end admin-placements-scroll */}
        </div>
      )}

      {viewingUser && (
        <ProfileModal
          userId={viewingUser.id}
          username={viewingUser.username}
          isAdmin={true}
          onClose={() => setViewingUser(null)}
          onSignOut={() => {}}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: 'var(--green-bg)', border: '1px solid var(--green-border)',
          color: 'var(--green)', padding: '10px 16px',
          borderRadius: '7px', fontSize: '13px', fontWeight: 600,
          zIndex: 200, animation: 'slideUp .2s ease',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}