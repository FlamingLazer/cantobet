import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'
import type { PlaceBetRequest } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: PlaceBetRequest = await req.json()
  const { race_runner_id, wager } = body

  if (!race_runner_id || !wager || wager < 10) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: raceRunner, error: rrError } = await service
    .from('race_runners')
    .select('*, race:races(*)')
    .eq('id', race_runner_id)
    .single()

  if (rrError || !raceRunner) {
    return NextResponse.json({ error: 'Race not found' }, { status: 404 })
  }

  const race = raceRunner.race
  if (race.status !== 'open') {
    return NextResponse.json({ error: 'Betting is closed for this race' }, { status: 409 })
  }
  if (new Date(race.scheduled_at) <= new Date()) {
    return NextResponse.json({ error: 'Race has already started' }, { status: 409 })
  }
  if (raceRunner.odds === null) {
    return NextResponse.json({ error: 'Odds not set yet' }, { status: 409 })
  }

  const { data: profile } = await service
    .from('users')
    .select('studs_balance')
    .eq('id', user.id)
    .single()

  if (!profile || profile.studs_balance < wager) {
    return NextResponse.json({ error: 'Insufficient Studs' }, { status: 409 })
  }

  const { data: raceRunnerIds } = await service
    .from('race_runners')
    .select('id')
    .eq('race_id', race.id)

  const { data: existingBet } = await service
    .from('bets')
    .select('id')
    .eq('user_id', user.id)
    .in('race_runner_id', raceRunnerIds?.map((r: { id: string }) => r.id) ?? [])
    .single()

  if (existingBet) {
    return NextResponse.json({ error: 'You have already bet on this race' }, { status: 409 })
  }

  const odds = raceRunner.odds
  const potential_payout = Math.floor(wager * odds)

  const { data: bet, error: betError } = await service
    .from('bets')
    .insert({
      user_id: user.id,
      race_runner_id,
      wager,
      odds_at_placement: odds,
      potential_payout,
      status: 'pending',
    })
    .select()
    .single()

  if (betError || !bet) {
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 })
  }

  const { new_balance, error: studsError } = await mutateStuds({
    supabase: service,
    user_id: user.id,
    amount: -wager,
    reason: 'bet_placed',
    ref_id: bet.id,
  })

  if (studsError) {
    await service.from('bets').delete().eq('id', bet.id)
    return NextResponse.json({ error: 'Failed to deduct Studs' }, { status: 500 })
  }

  return NextResponse.json({ bet, new_balance }, { status: 201 })
}