'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import ProfileModal from './ProfileModal'

interface HeaderProps {
  points: number
  onPointsUpdate: (points: number) => void
  isAdmin: boolean
  onAdminChange: (isAdmin: boolean) => void
}

export default function Header({ points, onPointsUpdate, isAdmin, onAdminChange }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetchProfile(user.id)
      } else {
        setProfileLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setUsername(null)
        onAdminChange(false)
        onPointsUpdate(0)
        setProfileLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('is_admin, points, twitch_username')
      .eq('id', userId)
      .single()
    if (data) {
      onAdminChange(data.is_admin)
      onPointsUpdate(data.points ?? 0)
      setUsername(data.twitch_username)
    }
    setProfileLoading(false)
  }

  async function signInWithTwitch() {
    await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'user:read:email',
      },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setUsername(null)
    onAdminChange(false)
    onPointsUpdate(0)
    setProfileOpen(false)
    setProfileLoading(false)
  }

  return (
    <>
      <header style={{
        background: 'rgba(8,11,16,.92)',
        backdropFilter: 'blur(12px)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
      }}>
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '3px',
          color: '#ffffff',
        }}>
          <span style={{ color: '#ffffff' }}>PREDIC</span><span style={{ color: '#9aaabb' }}>TIONS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!profileLoading && (
            user ? (
              <>
                <div style={{
                  background: 'var(--gold-bg)',
                  border: '1px solid var(--gold-dim)',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--gold)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}>
                  <div style={{
                    width: '12px', height: '12px',
                    borderRadius: '50%',
                    background: 'var(--gold)',
                    flexShrink: 0,
                  }} />
                  {points.toFixed(1)} pts
                </div>

                <div
                  onClick={() => setProfileOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    background: 'var(--navy3)',
                    border: '0.5px solid var(--border)',
                    borderRadius: '6px',
                    padding: '5px 11px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--borderb)'
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--navy4)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--navy3)'
                  }}
                >
                  <div style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: 'var(--green)',
                  }} />
                  {username}
                  <span style={{ fontSize: '10px', color: 'var(--dim)' }}>▾</span>
                </div>
              </>
            ) : (
              <button
                onClick={signInWithTwitch}
                style={{
                  background: '#6441a4',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
                Log in with Twitch
              </button>
            )
          )}
        </div>
      </header>

      {profileOpen && user && (
        <ProfileModal
          userId={user.id}
          username={username ?? ''}
          isAdmin={isAdmin}
          onClose={() => setProfileOpen(false)}
          onSignOut={signOut}
        />
      )}
    </>
  )
}