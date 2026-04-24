import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'
import { season3 } from '@/lib/participants'

const SRC_URL = 'https://www.speedrun.com/api/v1/leaderboards/46w33l1r/category/9d8p7ylk?embed=players&platform=PC&top=150&var-j84pew89=0q5v2grl'

function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const lbRes = await fetch(SRC_URL, { headers: { 'User-Agent': 'cantobet/1.0' } })
  if (!lbRes.ok) return NextResponse.json({ error: 'Failed to fetch speedrun.com leaderboard' }, { status: 502 })
  const lbData = await lbRes.json()

  // Build player id → {slug, intl} index
  const playerIndex: Record<string, { slug: string; intl: string }> = {}
  for (const pl of (lbData.data?.players?.data ?? [])) {
    const slug = (pl.weblink || '').replace(/.*\//, '').toLowerCase()
    const intl = (pl.names?.international || '').toLowerCase()
    playerIndex[pl.id] = { slug, intl }
  }

  // Build lowercase username → PB seconds
  const srcPBMap: Record<string, number> = {}
  for (const entry of (lbData.data?.runs ?? [])) {
    const pid = entry.run?.players?.[0]?.id
    const info = pid ? playerIndex[pid] : null
    const t: number | undefined = entry.run?.times?.realtime_t
    if (!info || t == null) continue
    if (info.slug && srcPBMap[info.slug] == null) srcPBMap[info.slug] = t
    if (info.intl && info.intl !== info.slug && srcPBMap[info.intl] == null) srcPBMap[info.intl] = t
  }

  // name (DB username) → SRC username mapping from participants list
  const toSrcUsername: Record<string, string> = {}
  for (const p of season3) {
    toSrcUsername[p.name.toLowerCase()] = (p.username ?? p.name).toLowerCase()
  }

  const { data: runners, error: runnersError } = await service.from('runners').select('id, username')
  if (runnersError) return NextResponse.json({ error: runnersError.message }, { status: 500 })

  const updates: { username: string; pb: string }[] = []
  for (const runner of runners ?? []) {
    const srcUsername = toSrcUsername[runner.username.toLowerCase()] ?? runner.username.toLowerCase()
    const seconds = srcPBMap[srcUsername]
    if (seconds != null) {
      await service.from('runners').update({ pb: secondsToTime(seconds) }).eq('id', runner.id)
      updates.push({ username: runner.username, pb: secondsToTime(seconds) })
    }
  }

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'pbs_synced',
    description: `Synced SRC PBs. Updated ${updates.length} runner(s): ${updates.map(u => `${u.username} → ${u.pb}`).join(', ')}.`,
    metadata: { updates },
  })

  return NextResponse.json({ updated: updates.length, runners: updates })
}
