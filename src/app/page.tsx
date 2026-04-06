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

export default function Home() {
  const [activeTab, setActiveTab] = useState('races')
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
    <div style={{ minHeight: '100vh', background: 'var(--navy)' }}>
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
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '16px',
      }}>
        {activeTab === 'races' && <RacesFeed />}
        {activeTab === 'my-picks' && <MyBets />}
        {activeTab === 'history' && <HistoryFeed />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'admin' && <AdminPanel />}
      </div>
    </div>
  )
}