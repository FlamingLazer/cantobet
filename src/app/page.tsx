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

export default function Home() {
  const [activeTab, setActiveTab] = useState('races')
  const [isAdmin, setIsAdmin] = useState(false)
  const [studsBalance, setStudsBalance] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)
  const [watchKey, setWatchKey] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const supabase = createClient()

  const channel = 'lazer_flaming'

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
          <StreamEmbed isLive={isLive} channel={channel} />
          {activeTab === 'races' && <RacesFeed />}
          {activeTab === 'futures' && <FuturesFeed />}
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