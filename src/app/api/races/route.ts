import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'

export async function GET() {
  const service = createServiceClient()

  const { data, error } = await service
    .from('races')
    .select(`
      *,
      race_runners (
        id, odds, finish_position, finish_time,
        runner:runners (id, username, character, pb, seed, current_rung, status, country_code)
      )
    `)
    .neq('status', 'settled')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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