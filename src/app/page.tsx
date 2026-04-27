'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Header from './components/Header'
import Nav from './components/Nav'
import RacesFeed from './components/RacesFeed'
import HistoryFeed from './components/HistoryFeed'
import Leaderboard from './components/Leaderboard'
import AdminPanel from './components/AdminPanel'
import MyBets from './components/MyBets'
import FuturesFeed from './components/FuturesFeed'

export default function Home() {
  const [activeTab, setActiveTab] = useState('futures')
  const [isAdmin, setIsAdmin] = useState(false)
  const [points, setPoints] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setLoggedIn(true)
        supabase
          .from('users')
          .select('is_admin, points')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setIsAdmin(data.is_admin)
              setPoints(data.points ?? 0)
            }
          })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
      if (!session?.user) {
        setIsAdmin(false)
        setPoints(0)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <Header
          points={points}
          onPointsUpdate={setPoints}
          isAdmin={isAdmin}
          onAdminChange={setIsAdmin}
        />
        <Nav
          activeTab={activeTab}
          isAdmin={isAdmin}
          onTabChange={setActiveTab}
        />
      </div>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '16px',
      }}>
        {activeTab === 'races' && <RacesFeed loggedIn={loggedIn} />}
        {activeTab === 'my-picks' && <MyBets loggedIn={loggedIn} />}
        {activeTab === 'futures' && <FuturesFeed loggedIn={loggedIn} />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'history' && (isAdmin || process.env.NODE_ENV === 'development') && <HistoryFeed />}
        {activeTab === 'admin' && (isAdmin || process.env.NODE_ENV === 'development') && <AdminPanel />}

        <div style={{ textAlign: 'center', padding: '32px 16px 16px' }}>
          <a
            href="https://ladderleague.run"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '1.5px',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: '4px',
              padding: '0.5rem 1.2rem',
              textDecoration: 'none',
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent)'
              ;(e.currentTarget as HTMLAnchorElement).style.color = '#000'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'
            }}
          >
            Return to LadderLeague.run
          </a>
        </div>
      </div>
    </div>
  )
}