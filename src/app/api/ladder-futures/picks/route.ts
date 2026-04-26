import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { picks } = body as { picks: { runner_id: string; direction: 'over' | 'under' }[] }

  if (!Array.isArray(picks) || picks.length !== 8) {
    return NextResponse.json({ error: 'Must submit exactly 8 picks' }, { status: 400 })
  }

  for (const p of picks) {
    if (!p.runner_id || (p.direction !== 'over' && p.direction !== 'under')) {
      return NextResponse.json({ error: 'Invalid pick format' }, { status: 400 })
    }
  }

  const runnerIds = picks.map(p => p.runner_id)
  if (new Set(runnerIds).size !== 8) {
    return NextResponse.json({ error: 'Duplicate runners in picks' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: config } = await service
    .from('ladder_futures_config')
    .select('is_locked')
    .single()

  if (config?.is_locked) {
    return NextResponse.json({ error: 'Predictions are locked' }, { status: 409 })
  }

  // Verify all picked runners have lines set
  const { data: lines } = await service
    .from('ladder_futures_lines')
    .select('runner_id')
    .in('runner_id', runnerIds)

  if (!lines || lines.length !== 8) {
    return NextResponse.json({ error: 'One or more runners have no line set' }, { status: 409 })
  }

  // Verify none of the picked runners are already settled
  const { data: settledLines } = await service
    .from('ladder_futures_lines')
    .select('runner_id')
    .in('runner_id', runnerIds)
    .not('settled_at', 'is', null)

  if (settledLines && settledLines.length > 0) {
    return NextResponse.json({ error: 'Cannot pick an already-settled runner' }, { status: 409 })
  }

  // Delete existing picks and re-insert
  await service.from('ladder_futures_picks').delete().eq('user_id', user.id)

  const rows = picks.map(p => ({
    user_id: user.id,
    runner_id: p.runner_id,
    direction: p.direction,
    is_correct: null,
  }))

  const { error } = await service.from('ladder_futures_picks').insert(rows)
  if (error) return NextResponse.json({ error: 'Failed to save picks' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
