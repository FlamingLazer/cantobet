'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface WatchEarnProps {
  loggedIn: boolean
  onStudsCredited: (amount: number, newBalance: number) => void
  onLiveChange?: (live: boolean) => void
}

export default function WatchEarn({ loggedIn, onStudsCredited, onLiveChange }: WatchEarnProps) {
  const [minutesWatched, setMinutesWatched] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const [sessionStuds, setSessionStuds] = useState(0)
  const supabase = createClient()

  const BONUS_THRESHOLD = 60
  const progressPct = Math.min(100, Math.round((minutesWatched % BONUS_THRESHOLD) / BONUS_THRESHOLD * 100))
  const bonusesEarned = Math.floor(minutesWatched / BONUS_THRESHOLD)
  const minutesToNextBonus = BONUS_THRESHOLD - (minutesWatched % BONUS_THRESHOLD)

  useEffect(() => {
    if (!loggedIn) return
    fetchSessionData()
  }, [loggedIn])

  useEffect(() => {
    checkLive()
    const interval = setInterval(checkLive, 120_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (sessionStuds > 0) {
      const mins = Math.round(sessionStuds / 10)
      setMinutesWatched(mins)
    }
  }, [sessionStuds])

  async function checkLive() {
    try {
      const res = await fetch('/api/stream-status')
      const data = await res.json()
      setIsLive(data.live)
      onLiveChange?.(data.live)
    } catch {}
  }

  async function fetchSessionData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('watch_sessions')
      .select('studs_credited')
      .eq('user_id', user.id)
      .gte('started_at', new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const mins = Math.round(data.studs_credited / 10)
      setMinutesWatched(mins)
      setSessionStuds(data.studs_credited)
    }
  }

  if (!loggedIn) {
    return (
      <div style={{
        background: 'var(--navy2)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '11px',
        color: 'var(--muted)',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        <div style={{ fontSize: '20px', marginBottom: '6px' }}>📺</div>
        Log in with Twitch to earn Studs while watching the stream.
        <div style={{ marginTop: '6px', color: 'var(--dim)', fontSize: '10px' }}>
          +10 Studs per minute · 60 min bonus
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--navy2)',
      border: `0.5px solid ${isLive ? 'var(--red-border)' : 'var(--border)'}`,
      borderRadius: '8px',
      padding: '12px',
      transition: 'border-color .3s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: '7px', marginBottom: '6px',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#9146ff">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
        </svg>
        <span style={{
          fontSize: '13px', fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: '.3px',
        }}>
          Watch to Earn
        </span>
        {isLive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            marginLeft: 'auto',
            fontSize: '10px', fontWeight: 700,
            color: 'var(--red2)',
          }}>
            <div style={{
              width: '5px', height: '5px',
              borderRadius: '50%', background: 'var(--red2)',
              animation: 'pulse 1.2s infinite',
            }} />
            LIVE
          </div>
        )}
      </div>

      {/* Rate */}
      <div style={{
        fontSize: '11px', color: 'var(--muted)',
        marginBottom: '10px',
      }}>
        {isLive
          ? '+10 Studs per minute while live'
          : 'Stream is offline — check back later'}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '10px', color: 'var(--muted)',
          marginBottom: '5px',
        }}>
          <span>{minutesWatched % BONUS_THRESHOLD} / {BONUS_THRESHOLD} min</span>
          <span style={{ color: 'var(--gold)' }}>
            {minutesToNextBonus === BONUS_THRESHOLD
              ? `${BONUS_THRESHOLD} min bonus`
              : `${minutesToNextBonus} min to bonus`}
          </span>
        </div>
        <div style={{
          height: '5px',
          background: 'var(--navy3)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: isLive
              ? 'linear-gradient(90deg, var(--red), var(--red2))'
              : 'var(--navy4)',
            borderRadius: '3px',
            transition: 'width .6s ease',
          }} />
        </div>
      </div>

      {/* Session stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        marginTop: '8px',
        background: 'var(--navy3)',
        borderRadius: '5px',
        padding: '5px 8px',
        border: '0.5px solid var(--border)',
      }}>
        {isLive ? (
          <>
            <div style={{
              width: '6px', height: '6px',
              borderRadius: '50%', background: 'var(--green)',
              animation: 'pulse 1.5s infinite',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Earning now
            </span>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--dim)' }}>
            Not earning
          </span>
        )}
        <span style={{
          fontSize: '11px', fontWeight: 700,
          color: 'var(--gold)', marginLeft: 'auto',
        }}>
          +{sessionStuds.toLocaleString()} this session
        </span>
      </div>

      {bonusesEarned > 0 && (
        <div style={{
          marginTop: '6px',
          fontSize: '10px', color: 'var(--muted)',
          textAlign: 'center',
        }}>
          🎯 {bonusesEarned} bonus milestone{bonusesEarned > 1 ? 's' : ''} reached this session
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}