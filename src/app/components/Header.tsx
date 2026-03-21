'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import ProfileModal from './ProfileModal'

interface HeaderProps {
  studsBalance: number
  onBalanceUpdate: (balance: number) => void
  isAdmin: boolean
  onAdminChange: (isAdmin: boolean) => void
}

export default function Header({ studsBalance, onBalanceUpdate, isAdmin, onAdminChange }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isLive, setIsLive] = useState(false)
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
        onBalanceUpdate(0)
        setProfileLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    checkLive()
    const interval = setInterval(checkLive, 120_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('is_admin, studs_balance, twitch_username')
      .eq('id', userId)
      .single()
    if (data) {
      onAdminChange(data.is_admin)
      onBalanceUpdate(data.studs_balance)
      setUsername(data.twitch_username)
    }
    setProfileLoading(false)
  }

  async function checkLive() {
    try {
      const res = await fetch('/api/stream-status')
      const data = await res.json()
      setIsLive(data.live)
    } catch {}
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
    onBalanceUpdate(0)
    setProfileOpen(false)
    setProfileLoading(false)
  }

  return (
    <>
      <header style={{
        background: 'var(--navy2)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '3px',
          color: 'var(--white)',
        }}>
          LADDER<span style={{ color: 'var(--red2)' }}>BOOK</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLive && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', fontWeight: 700, color: 'var(--red2)',
              background: 'var(--red-bg)', border: '1px solid var(--red-border)',
              borderRadius: '4px', padding: '4px 9px',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--red2)',
                animation: 'pulse 1.2s infinite',
              }} />
              LIVE
            </div>
          )}

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
                  {studsBalance.toLocaleString()} Studs
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>

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