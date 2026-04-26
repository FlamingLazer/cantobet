import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const service = createServiceClient()
  let userId: string | null = null

  if (process.env.NODE_ENV !== 'development') {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await service.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    userId = user.id
  }

  const body = await req.json()
  const { runner_id, final_position } = body

  if (!runner_id || typeof final_position !== 'number' || final_position < 1 || final_position > 21) {
    return NextResponse.json({ error: 'runner_id and final_position (1–21) required' }, { status: 400 })
  }

  const { data: line } = await service
    .from('ladder_futures_lines')
    .select('id, line, settled_at, runner:runners(username)')
    .eq('runner_id', runner_id)
    .single()

  if (!line) return NextResponse.json({ error: 'No line set for this runner' }, { status: 404 })
  if (line.settled_at) return NextResponse.json({ error: 'Already settled' }, { status: 409 })

  const { data: config } = await service
    .from('ladder_futures_config')
    .select('points_per_correct_pick')
    .single()

  const pts = config?.points_per_correct_pick ?? 100

  // Mark line as settled
  await service
    .from('ladder_futures_lines')
    .update({ final_position, settled_at: new Date().toISOString() })
    .eq('runner_id', runner_id)

  // Find all picks for this runner
  const { data: picks } = await service
    .from('ladder_futures_picks')
    .select('id, user_id, direction')
    .eq('runner_id', runner_id)

  if (!picks || picks.length === 0) {
    const runnerName = (line.runner as { username: string } | null)?.username ?? runner_id
    if (userId) await writeAuditLog({ admin_user_id: userId, action_type: 'futures_settled', description: `Settled futures for ${runnerName}: finished ${final_position} (0 picks)` })
    return NextResponse.json({ ok: true, winners: 0 })
  }

  const lineValue = Number(line.line)
  let winners = 0

  for (const pick of picks) {
    const correct =
      (pick.direction === 'over' && final_position > lineValue) ||
      (pick.direction === 'under' && final_position < lineValue)

    await service
      .from('ladder_futures_picks')
      .update({ is_correct: correct })
      .eq('id', pick.id)

    if (correct) {
      winners++
      await service.rpc('credit_points', { p_user_id: pick.user_id, p_amount: pts })
    }
  }

  const runnerName = (line.runner as { username: string } | null)?.username ?? runner_id
  if (userId) await writeAuditLog({
    admin_user_id: userId,
    action_type: 'futures_settled',
    description: `Settled futures for ${runnerName}: finished ${final_position} (line ${lineValue}) — ${winners}/${picks.length} correct`,
  })

  return NextResponse.json({ ok: true, winners, total: picks.length })
}
