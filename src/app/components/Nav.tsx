'use client'

interface NavProps {
  activeTab: string
  isAdmin: boolean
  onTabChange: (tab: string) => void
}

export default function Nav({ activeTab, isAdmin, onTabChange }: NavProps) {
  const tabs = [
    { id: 'races', label: 'Races' },
    { id: 'my-picks', label: 'My Picks' },
    { id: 'leaderboard', label: 'Leaderboard' },
    ...(isAdmin ? [{ id: 'history', label: 'History' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: '⚙ Admin' }] : []),
  ]

  return (
    <nav className="mobile-nav" style={{
      background: 'rgba(8,11,16,.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      padding: '0 20px',
      gap: '2px',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 700,
            color: activeTab === tab.id ? 'var(--white)' : tab.id === 'admin' ? 'var(--orange)' : 'var(--muted)',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: `2px solid ${activeTab === tab.id ? (tab.id === 'admin' ? 'var(--orange)' : 'var(--red2)') : 'transparent'}`,
            fontFamily: "'Rubik', sans-serif",
            letterSpacing: '.8px',
            textTransform: 'uppercase',
            transition: 'all .15s',
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}