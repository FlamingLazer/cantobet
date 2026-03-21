import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'
import { writeAuditLog } from '@/lib/audit'
import type { SettleRaceRequest } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('users')
    .select('is_admin, twitch_username')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: SettleRaceRequest = await req.json()
  const { race_id, results } = body

  if (!race_id || !results?.length) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: race } = await service
    .from('races')
    .select('*')
    .eq('id', race_id)
    .single()

  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })
  if (race.status === 'settled') {
    return NextResponse.json({ error: 'Race already settled' }, { status: 409 })
  }

  const winnerResult = results.find(r => r.finish_position === 1)
  if (!winnerResult) {
    return NextResponse.json({ error: 'No 1st place result provided' }, { status: 400 })
  }

  for (const result of results) {
    await service
      .from('race_runners')
      .update({
        finish_position: result.finish_position,
        finish_time: result.finish_time,
      })
      .eq('id', result.race_runner_id)
  }

  const { data: winnerRR } = await service
    .from('race_runners')
    .select('runner_id, runner:runners(username)')
    .eq('id', winnerResult.race_runner_id)
    .single()

  await service
    .from('races')
    .update({
      status: 'settled',
      winner_runner_id: winnerRR?.runner_id ?? null,
    })
    .eq('id', race_id)

  const allRaceRunnerIds = results.map(r => r.race_runner_id)

  const { data: bets } = await service
    .from('bets')
    .select('*')
    .in('race_runner_id', allRaceRunnerIds)
    .eq('status', 'pending')

  let paidOut = 0
  let winners = 0
  let losers = 0

  if (bets?.length) {
    for (const bet of bets) {
      const isWinner = bet.race_runner_id === winnerResult.race_runner_id

      await service
        .from('bets')
        .update({ status: isWinner ? 'won' : 'lost' })
        .eq('id', bet.id)

      if (isWinner) {
        const { error } = await mutateStuds({
          supabase: service,
          user_id: bet.user_id,
          amount: bet.potential_payout,
          reason: 'bet_won',
          ref_id: bet.id,
        })
        if (!error) {
          paidOut += bet.potential_payout
          winners++
        }
      } else {
        losers++
      }
    }
  }

  const winnerUsername = (winnerRR?.runner as { username?: string } | null)?.username ?? 'unknown'

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'race_settled',
    description: `Settled W${race.week} · Rung ${race.rung} — winner ${winnerUsername} (${winnerResult.finish_time}). ${winners} bets paid out, ${losers} lost.`,
    metadata: { race_id, results, winners, losers, studs_paid_out: paidOut },
  })

  return NextResponse.json({ settled: bets?.length ?? 0, paid_out: paidOut, winners, losers })
}