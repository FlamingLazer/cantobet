import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { race_runner_id } = body

  if (!race_runner_id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()

  // Load race_runner + race
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
    return NextResponse.json({ error: 'Predictions are closed for this race' }, { status: 409 })
  }
  if (new Date(race.scheduled_at) <= new Date()) {
    return NextResponse.json({ error: 'Race has already started' }, { status: 409 })
  }

  // Check user hasn't already predicted this race
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
    return NextResponse.json({ error: 'You have already predicted this race' }, { status: 409 })
  }

  const odds = raceRunner.odds ?? 0
  const potential_payout = odds

  // Insert prediction with wager of 0
  const { data: bet, error: betError } = await service
    .from('bets')
    .insert({
      user_id: user.id,
      race_runner_id,
      wager: 0,
      odds_at_placement: odds,
      potential_payout,
      status: 'pending',
    })
    .select()
    .single()

  if (betError || !bet) {
    return NextResponse.json({ error: 'Failed to place prediction' }, { status: 500 })
  }

  return NextResponse.json({ bet }, { status: 201 })
}