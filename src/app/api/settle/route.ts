import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'
import { writeAuditLog } from '@/lib/audit'
import type { SettleRaceRequest } from '@/types'

// Convert interval string to seconds for comparison
function timeToSeconds(time: string): number {
  const parts = time.replace(':', ':').split(':')
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
  }
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  }
  return 0
}

async function checkLeapfrog(
  service: any,
  week: number,
  lowerRung: number,  // the rung that might leapfrog into
  upperRung: number,  // the rung being leapfrogged into
) {
  // Don't leapfrog into rung 0 or below
  if (upperRung < 1) return
  // Leapfrog doesn't apply from rung 2 into rung 1 going to rung -1
  // and not from rung 1
  if (lowerRung <= 1) return
  // Leapfrog target would be upperRung - 1, so skip if lowerRung is 2
  // (winner of rung 2 goes to rung 1 normally, can't go to rung -1)
  if (lowerRung === 2) return

  // Get lower rung settled race this week
  const { data: lowerRace } = await service
    .from('races')
    .select('id')
    .eq('week', week)
    .eq('rung', lowerRung)
    .eq('status', 'settled')
    .single()

  if (!lowerRace) return

  // Get upper rung settled race this week
  const { data: upperRace } = await service
    .from('races')
    .select('id')
    .eq('week', week)
    .eq('rung', upperRung)
    .eq('status', 'settled')
    .single()

  if (!upperRace) return

  // Get winner of lower rung
  const { data: lowerRunners } = await service
    .from('race_runners')
    .select('id, finish_position, finish_time, runner_id')
    .eq('race_id', lowerRace.id)
    .order('finish_position')

  const lowerWinner = lowerRunners?.find((r: any) => r.finish_position === 1)
  if (!lowerWinner?.finish_time) return

  // Get 2nd place of upper rung
  const { data: upperRunners } = await service
    .from('race_runners')
    .select('id, finish_position, finish_time, runner_id')
    .eq('race_id', upperRace.id)
    .order('finish_position')

  const upperSecond = upperRunners?.find((r: any) => r.finish_position === 2)
  if (!upperSecond?.finish_time) return

  const lowerTime = timeToSeconds(lowerWinner.finish_time.toString())
  const upperTime = timeToSeconds(upperSecond.finish_time.toString())

  // Lower winner beats upper 2nd place — leapfrog!
  if (lowerTime < upperTime) {
    // Mark lower winner as leapfrog
    await service
      .from('race_runners')
      .update({ leapfrog: true })
      .eq('id', lowerWinner.id)

    // Mark upper 2nd place as leapfrogged
    await service
      .from('race_runners')
      .update({ leapfrogged: true })
      .eq('id', upperSecond.id)
  } else {
    // Clear flags in case of unsettle/resettle
    await service
      .from('race_runners')
      .update({ leapfrog: false })
      .eq('id', lowerWinner.id)

    await service
      .from('race_runners')
      .update({ leapfrogged: false })
      .eq('id', upperSecond.id)
  }
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

  // ── 3. Settle straight bets ────────────────────────────────────────────────
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

  // ── 4. Settle parlay legs ──────────────────────────────────────────────────
  const { data: parlays } = await service
    .from('parlay_bets')
    .select('*')
    .eq('status', 'pending')
    .eq('bet_type', 'race')

  if (parlays?.length) {
    for (const parlay of parlays) {
      const legs = parlay.legs as {
        race_runner_id: string
        odds: number
        runner_username: string
        race_week: number
        race_rung: number
        status: string
      }[]

      const hasLegsInThisRace = legs.some(leg =>
        allRaceRunnerIds.includes(leg.race_runner_id)
      )
      if (!hasLegsInThisRace) continue

      const updatedLegs = legs.map(leg => {
        if (!allRaceRunnerIds.includes(leg.race_runner_id)) return leg
        const isWinningLeg = leg.race_runner_id === winnerResult.race_runner_id
        return { ...leg, status: isWinningLeg ? 'won' : 'lost' }
      })

      const anyLost = updatedLegs.some(leg => leg.status === 'lost')
      const allWon = updatedLegs.every(leg => leg.status === 'won')

      if (anyLost) {
        await service
          .from('parlay_bets')
          .update({ status: 'lost', legs: updatedLegs })
          .eq('id', parlay.id)
      } else if (allWon) {
        await service
          .from('parlay_bets')
          .update({ status: 'won', legs: updatedLegs })
          .eq('id', parlay.id)

        const { error } = await mutateStuds({
          supabase: service,
          user_id: parlay.user_id,
          amount: parlay.potential_payout,
          reason: 'bet_won',
          ref_id: parlay.id,
        })
        if (!error) {
          paidOut += parlay.potential_payout
          winners++
        }
      } else {
        await service
          .from('parlay_bets')
          .update({ legs: updatedLegs })
          .eq('id', parlay.id)
      }
    }
  }

  // ── 5. Leapfrog check ─────────────────────────────────────────────────────
  // Check if this race's winner leapfrogs into the rung above the rung above
  // i.e. this is rung X, check leapfrog from X into X-1
  await checkLeapfrog(service, race.week, race.rung, race.rung - 1)

  // Check if the rung below this race leapfrogs into this race's rung
  // i.e. check leapfrog from rung X+1 into this rung X
  await checkLeapfrog(service, race.week, race.rung + 1, race.rung)

  // ── 6. Audit log ──────────────────────────────────────────────────────────
  const winnerUsername = (winnerRR?.runner as { username?: string } | null)?.username ?? 'unknown'

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'race_settled',
    description: `Settled W${race.week} · Rung ${race.rung} — winner ${winnerUsername} (${winnerResult.finish_time}). ${winners} bets paid out, ${losers} lost.`,
    metadata: { race_id, results, winners, losers, studs_paid_out: paidOut },
  })

  return NextResponse.json({ settled: bets?.length ?? 0, paid_out: paidOut, winners, losers })
}