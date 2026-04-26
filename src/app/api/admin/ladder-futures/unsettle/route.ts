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

  const { runner_id } = await req.json()
  if (!runner_id) return NextResponse.json({ error: 'runner_id required' }, { status: 400 })

  const { data: line } = await service
    .from('ladder_futures_lines')
    .select('id, line, final_position, settled_at, runner:runners(username)')
    .eq('runner_id', runner_id)
    .single()

  if (!line) return NextResponse.json({ error: 'No line found for this runner' }, { status: 404 })
  if (!line.settled_at) return NextResponse.json({ error: 'Runner is not settled' }, { status: 409 })

  // Load all picks for this runner
  const { data: picks } = await service
    .from('ladder_futures_picks')
    .select('id, user_id, is_correct, points_earned')
    .eq('runner_id', runner_id)

  let reversals = 0

  for (const pick of picks ?? []) {
    if (pick.is_correct === true && pick.points_earned) {
      await service.rpc('credit_points', { p_user_id: pick.user_id, p_points: -pick.points_earned })
    }
    await service
      .from('ladder_futures_picks')
      .update({ is_correct: null, points_earned: null })
      .eq('id', pick.id)
    reversals++
  }

  await service
    .from('ladder_futures_lines')
    .update({ final_position: null, settled_at: null })
    .eq('runner_id', runner_id)

  const runnerName = (line.runner as { username: string } | null)?.username ?? runner_id
  if (userId) await writeAuditLog({
    admin_user_id: userId,
    action_type: 'futures_settled',
    description: `Unsettled futures for ${runnerName} (was ${line.final_position}) — reversed ${reversals} pick${reversals !== 1 ? 's' : ''}`,
  })

  return NextResponse.json({ ok: true, reversals })
}
