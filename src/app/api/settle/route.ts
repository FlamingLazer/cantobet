import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'
import type { SettleRaceRequest } from '@/types'

async function creditPoints(service: any, userId: string, points: number): Promise<number> {
  const { data } = await service.rpc('credit_points', {
    p_user_id: userId,
    p_points: points,
  })
  return data as number
}

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

  // ── 1. Write finish times + positions ──────────────────────────────────────
  for (const result of results) {
    await service
      .from('race_runners')
      .update({
        finish_position: result.finish_position,
        finish_time: result.finish_time,
      })
      .eq('id', result.race_runner_id)
  }

  // ── 2. Mark race settled ───────────────────────────────────────────────────
  const { data: winnerRR } = await service
    .from('race_runners')
    .select('runner_id, odds, runner:runners(username)')
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

  // ── 3. Settle predictions and credit points ────────────────────────────────
  const { data: bets } = await service
    .from('bets')
    .select('*')
    .in('race_runner_id', allRaceRunnerIds)
    .eq('status', 'pending')

  let winners = 0
  let losers = 0
  let totalPointsAwarded = 0

  if (bets?.length) {
    for (const bet of bets) {
      const isWinner = bet.race_runner_id === winnerResult.race_runner_id

      if (isWinner) {
        const points = winnerRR?.odds ?? 0
        await service
          .from('bets')
          .update({ status: 'won', points_earned: points })
          .eq('id', bet.id)

        await creditPoints(service, bet.user_id, points)
        totalPointsAwarded += points
        winners++
      } else {
        await service
          .from('bets')
          .update({ status: 'lost', points_earned: 0 })
          .eq('id', bet.id)
        losers++
      }
    }
  }

  // ── 4. Leapfrog check ─────────────────────────────────────────────────────
  await checkLeapfrog(service, race.week, race.rung, race.rung - 1)
  await checkLeapfrog(service, race.week, race.rung + 1, race.rung)

  // ── 5. Audit log ──────────────────────────────────────────────────────────
  const winnerUsername = (winnerRR?.runner as { username?: string } | null)?.username ?? 'unknown'

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'race_settled',
    description: `Settled W${race.week} · Rung ${race.rung} — winner ${winnerUsername} (${winnerResult.finish_time}). ${winners} correct predictions, ${totalPointsAwarded.toFixed(1)} points awarded.`,
    metadata: { race_id, results, winners, losers, points_awarded: totalPointsAwarded },
  })

  return NextResponse.json({ settled: bets?.length ?? 0, winners, losers, points_awarded: totalPointsAwarded })
}

function timeToSeconds(time: string): number {
  const parts = time.split(':')
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
  }
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  }
  return 0
}

async function checkLeapfrog(service: any, week: number, lowerRung: number, upperRung: number) {
  if (upperRung < 1) return
  if (lowerRung <= 1) return
  if (lowerRung === 2) return

  const { data: lowerRace } = await service
    .from('races').select('id').eq('week', week).eq('rung', lowerRung).eq('status', 'settled').single()
  if (!lowerRace) return

  const { data: upperRace } = await service
    .from('races').select('id').eq('week', week).eq('rung', upperRung).eq('status', 'settled').single()
  if (!upperRace) return

  const { data: lowerRunners } = await service
    .from('race_runners').select('id, finish_position, finish_time, runner_id').eq('race_id', lowerRace.id).order('finish_position')
  const lowerWinner = lowerRunners?.find((r: any) => r.finish_position === 1)
  if (!lowerWinner?.finish_time) return

  const { data: upperRunners } = await service
    .from('race_runners').select('id, finish_position, finish_time, runner_id').eq('race_id', upperRace.id).order('finish_position')
  const upperSecond = upperRunners?.find((r: any) => r.finish_position === 2)
  if (!upperSecond?.finish_time) return

  const lowerTime = timeToSeconds(lowerWinner.finish_time.toString())
  const upperTime = timeToSeconds(upperSecond.finish_time.toString())

  if (lowerTime < upperTime) {
    await service.from('race_runners').update({ leapfrog: true }).eq('id', lowerWinner.id)
    await service.from('race_runners').update({ leapfrogged: true }).eq('id', upperSecond.id)
  } else {
    await service.from('race_runners').update({ leapfrog: false }).eq('id', lowerWinner.id)
    await service.from('race_runners').update({ leapfrogged: false }).eq('id', upperSecond.id)
  }
}