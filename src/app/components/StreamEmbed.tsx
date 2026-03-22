'use client'

import { useState, useEffect } from 'react'

interface StreamEmbedProps {
  isLive: boolean
  channel: string
}

export default function StreamEmbed({ isLive, channel }: StreamEmbedProps) {
  const [hostname, setHostname] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    setHostname(window.location.hostname)
  }, [])

  if (!hostname || dismissed || !isLive) return null

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  const embedSrc = 'https://player.twitch.tv/?channel=' + channel + '&parent=' + hostname + '&autoplay=true'

  return (
    <div style={{
      background: 'var(--navy2)',
      border: '0.5px solid var(--red-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '10px',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--navy3)',
        borderBottom: minimized ? 'none' : '0.5px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '6px', height: '6px',
            borderRadius: '50%', background: 'var(--red2)',
            animation: 'pulse 1.2s infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '12px', fontWeight: 700,
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: '.5px', color: 'var(--white)',
          }}>
            LIVE NOW
          </span>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {channel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand stream' : 'Minimize stream'}
            style={{
              background: 'var(--navy4)',
              border: '0.5px solid var(--border)',
              color: 'var(--muted)',
              fontSize: '12px',
              cursor: 'pointer',
              borderRadius: '4px',
              padding: '2px 8px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              letterSpacing: '.5px',
            }}
          >
            {minimized ? '▲ EXPAND' : '▼ MINIMIZE'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            title="Close stream"
            style={{
              background: 'none', border: 'none',
              color: 'var(--dim)', fontSize: '16px',
              cursor: 'pointer', lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          {isLocalhost && (
            <div style={{ padding: '12px', fontSize: '11px', color: 'var(--muted)' }}>
              Stream embed not supported on localhost. Will appear once deployed to Vercel.
            </div>
          )}
          {!isLocalhost && (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={embedSrc}
                height="100%"
                width="100%"
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  border: 'none',
                }}
                allowFullScreen
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}