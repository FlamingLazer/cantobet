'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Header from './components/Header'
import Nav from './components/Nav'
import RacesFeed from './components/RacesFeed'
import HistoryFeed from './components/HistoryFeed'
import Leaderboard from './components/Leaderboard'
import FuturesFeed from './components/FuturesFeed'
import AdminPanel from './components/AdminPanel'
import WatchEarn from './components/WatchEarn'
import StreamEmbed from './components/StreamEmbed'
import { useHeartbeat } from '@/hooks/useHeartbeat'

const channel = 'lazer_flaming'

const formatBox = (
  <div style={{
    background: 'var(--navy3)',
    border: '0.5px solid var(--borderb)',
    borderRadius: '7px',
    padding: '9px 12px',
    marginBottom: '10px',
  }}>
    <div style={{
      fontSize: '12px', fontWeight: 700, color: 'var(--white)',
      marginBottom: '3px',
      fontFamily: "'Barlow Condensed', sans-serif",
      letterSpacing: '.5px', textTransform: 'uppercase',
    }}>
      1v1v1 · Ladder League
    </div>
    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
      3 runners race simultaneously — fastest time wins. Bet on who wins each race. Betting closes when the race starts.
    </div>
    <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
      {[
        { label: '🥇 1st → moves up / qualifies', bg: '#1a1608', color: 'var(--gold)', border: 'var(--gold-dim)' },
        { label: '🥈 2nd → moves up', bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'var(--blue-border)' },
        { label: '🥉 3rd → drops down', bg: 'var(--red-bg)', color: 'var(--red2)', border: 'var(--red-border)' },
      ].map(p => (
        <span key={p.label} style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 8px',
          borderRadius: '10px', background: p.bg, color: p.color,
          border: `1px solid ${p.border}`,
        }}>
          {p.label}
        </span>
      ))}
    </div>
  </div>
)

export default function Home() {
  const [activeTab, setActiveTab] = useState('races')
  const [isAdmin, setIsAdmin] = useState(false)
  const [studsBalance, setStudsBalance] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)
  const [watchKey, setWatchKey] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setLoggedIn(true)
        supabase
          .from('users')
          .select('is_admin, studs_balance')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setIsAdmin(data.is_admin)
              setStudsBalance(data.studs_balance)
            }
          })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  function handleStudsCredited(amount: number, newBalance: number) {
    setStudsBalance(newBalance)
    setWatchKey(k => k + 1)
  }

  useHeartbeat({
    enabled: loggedIn,
    onStudsCredited: handleStudsCredited,
  })

  const showStream = activeTab === 'races' || activeTab === 'futures'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <Header
        studsBalance={studsBalance}
        onBalanceUpdate={setStudsBalance}
        isAdmin={isAdmin}
        onAdminChange={setIsAdmin}
      />
      <Nav
        activeTab={activeTab}
        isAdmin={isAdmin}
        onTabChange={setActiveTab}
      />
      <div style={{
        maxWidth: '1300px',
        margin: '0 auto',
        padding: '16px',
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: '16px',
        alignItems: 'start',
      }}>
        <main>
          {activeTab === 'races' && (
            <>
              {formatBox}
              <StreamEmbed isLive={isLive} channel={channel} />
              <RacesFeed hideFormatBox />
            </>
          )}
          {activeTab === 'futures' && (
            <>
              <StreamEmbed isLive={isLive} channel={channel} />
              <FuturesFeed />
            </>
          )}
          {activeTab === 'history' && <HistoryFeed />}
          {activeTab === 'leaderboard' && <Leaderboard />}
          {activeTab === 'admin' && <AdminPanel />}
        </main>

        <aside style={{ position: 'sticky', top: '68px' }}>
          <WatchEarn
            key={watchKey}
            loggedIn={loggedIn}
            onStudsCredited={handleStudsCredited}
            onLiveChange={setIsLive}
          />
        </aside>
      </div>
    </div>
  )
}