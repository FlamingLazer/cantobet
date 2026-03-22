import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'
import { writeAuditLog } from '@/lib/audit'

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

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { race_id } = await req.json()
  if (!race_id) return NextResponse.json({ error: 'Missing race_id' }, { status: 400 })

  // Load race
  const { data: race } = await service
    .from('races')
    .select('*')
    .eq('id', race_id)
    .single()

  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })
  if (race.status !== 'settled') {
    return NextResponse.json({ error: 'Race is not settled' }, { status: 409 })
  }

  // Load all race_runners
  const { data: raceRunners } = await service
    .from('race_runners')
    .select('id')
    .eq('race_id', race_id)

  const raceRunnerIds = raceRunners?.map((r: { id: string }) => r.id) ?? []

  // Load all settled bets for this race
  const { data: bets } = await service
    .from('bets')
    .select('*')
    .in('race_runner_id', raceRunnerIds)
    .in('status', ['won', 'lost'])

  let reversals = 0

  if (bets?.length) {
    for (const bet of bets) {
      if (bet.status === 'won') {
        // Deduct the payout that was credited
        await mutateStuds({
          supabase: service,
          user_id: bet.user_id,
          amount: -bet.potential_payout,
          reason: 'admin_adjustment',
          ref_id: bet.id,
        })
        // Refund the original wager
        await mutateStuds({
          supabase: service,
          user_id: bet.user_id,
          amount: bet.wager,
          reason: 'admin_adjustment',
          ref_id: bet.id,
        })
      } else if (bet.status === 'lost') {
        // Refund the wager
        await mutateStuds({
          supabase: service,
          user_id: bet.user_id,
          amount: bet.wager,
          reason: 'admin_adjustment',
          ref_id: bet.id,
        })
      }

      // Mark bet back to pending
      await service
        .from('bets')
        .update({ status: 'pending' })
        .eq('id', bet.id)

      reversals++
    }
  }

  // Clear finish times and positions
  await service
    .from('race_runners')
    .update({ finish_position: null, finish_time: null })
    .eq('race_id', race_id)

  // Reset race status
  await service
    .from('races')
    .update({ status: 'locked', winner_runner_id: null })
    .eq('id', race_id)

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'race_settled',
    description: `Unsettled W${race.week} · Rung ${race.rung} — reversed ${reversals} bet${reversals !== 1 ? 's' : ''} and refunded Studs.`,
    metadata: { race_id, week: race.week, rung: race.rung, reversals },
  })

  return NextResponse.json({ success: true, reversals })
}