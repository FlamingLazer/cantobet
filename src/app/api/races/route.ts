import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'
import { season3 } from '@/lib/participants'

const SRC_URL = 'https://www.speedrun.com/api/v1/leaderboards/46w33l1r/category/9d8p7ylk?embed=players&platform=PC&top=150&var-j84pew89=0q5v2grl'

// name (DB username) → SRC username
const toSrcUsername: Record<string, string> = {}
for (const p of season3) {
  toSrcUsername[p.name.toLowerCase()] = (p.username ?? p.name).toLowerCase()
}

let srcCache: { pbs: Record<string, string>; expiry: number } | null = null

function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

async function getSrcPBs(): Promise<Record<string, string>> {
  if (srcCache && Date.now() < srcCache.expiry) return srcCache.pbs

  try {
    const res = await fetch(SRC_URL, { headers: { 'User-Agent': 'cantobet/1.0' } })
    if (!res.ok) return srcCache?.pbs ?? {}
    const lbData = await res.json()

    const playerIndex: Record<string, { slug: string; intl: string }> = {}
    for (const pl of (lbData.data?.players?.data ?? [])) {
      const slug = (pl.weblink || '').replace(/.*\//, '').toLowerCase()
      const intl = (pl.names?.international || '').toLowerCase()
      playerIndex[pl.id] = { slug, intl }
    }

    const pbs: Record<string, string> = {}
    for (const entry of (lbData.data?.runs ?? [])) {
      const pid = entry.run?.players?.[0]?.id
      const info = pid ? playerIndex[pid] : null
      const t: number | undefined = entry.run?.times?.realtime_t
      if (!info || t == null) continue
      const formatted = secondsToTime(t)
      if (info.slug && !pbs[info.slug]) pbs[info.slug] = formatted
      if (info.intl && info.intl !== info.slug && !pbs[info.intl]) pbs[info.intl] = formatted
    }

    srcCache = { pbs, expiry: Date.now() + 10 * 60 * 1000 }
    return pbs
  } catch {
    return srcCache?.pbs ?? {}
  }
}

export async function GET() {
  const service = createServiceClient()

  const [{ data, error }, srcPBs] = await Promise.all([
    service
      .from('races')
      .select(`
        *,
        race_runners (
          id, odds, finish_position, finish_time,
          runner:runners (id, username, character, pb, seed, current_rung, status, country_code)
        )
      `)
      .neq('status', 'settled')
      .order('scheduled_at', { ascending: true }),
    getSrcPBs(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Merge SRC PBs into runner data
  const enriched = data?.map((race: Record<string, unknown>) => ({
    ...race,
    race_runners: (race.race_runners as Record<string, unknown>[]).map((rr) => {
      const runner = rr.runner as Record<string, unknown> | null
      if (!runner) return rr
      const srcUser = toSrcUsername[String(runner.username ?? '').toLowerCase()] ?? String(runner.username ?? '').toLowerCase()
      const srcPb = srcPBs[srcUser]
      return { ...rr, runner: { ...runner, pb: srcPb ?? runner.pb } }
    }),
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { week, rung, scheduled_at, is_top8_qualifier, runners, stage } = body

  if (!scheduled_at || !runners?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!stage && (!week || !rung)) {
    return NextResponse.json({ error: 'Provide either a stage name or week and rung' }, { status: 400 })
  }

  const { data: race, error: raceError } = await service
    .from('races')
    .insert({ week: week ?? 0, rung: rung ?? 0, scheduled_at, is_top8_qualifier: !!is_top8_qualifier, status: 'open', stage: stage ?? null })
    .select()
    .single()

  if (raceError || !race) {
    return NextResponse.json({ error: 'Failed to create race' }, { status: 500 })
  }

  const { error: rrError } = await service.from('race_runners').insert(
    runners.map((r: { runner_id: string; odds: number }) => ({
      race_id: race.id,
      runner_id: r.runner_id,
      odds: r.odds,
    }))
  )

  if (rrError) {
    await service.from('races').delete().eq('id', race.id)
    return NextResponse.json({ error: 'Failed to add runners' }, { status: 500 })
  }

  const { data: runnerRows } = await service
    .from('runners')
    .select('username')
    .in('id', runners.map((r: { runner_id: string }) => r.runner_id))

  const runnerNames = runnerRows?.map((r: { username: string }) => r.username).join(', ') ?? ''

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'race_created',
    description: `Created race ${stage ?? `W${week} · Rung ${rung}`} — ${runnerNames}. Scheduled ${new Date(scheduled_at).toLocaleString()}.`,
    metadata: { race_id: race.id, week, rung, scheduled_at, runners },
  })

  return NextResponse.json(race, { status: 201 })
}
