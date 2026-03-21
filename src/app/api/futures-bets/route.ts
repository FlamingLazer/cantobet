import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { market, runner_id, wager } = body

  if (!market || !runner_id || !wager || wager < 10) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()

  // Check market exists and is open
  const { data: marketRow } = await service
    .from('futures_markets')
    .select('*')
    .eq('market', market)
    .eq('runner_id', runner_id)
    .eq('is_open', true)
    .single()

  if (!marketRow) {
    return NextResponse.json({ error: 'Market not found or closed' }, { status: 404 })
  }

  if (!marketRow.odds) {
    return NextResponse.json({ error: 'Odds not set yet' }, { status: 409 })
  }

  // Check user balance
  const { data: profile } = await service
    .from('users')
    .select('studs_balance')
    .eq('id', user.id)
    .single()

  if (!profile || profile.studs_balance < wager) {
    return NextResponse.json({ error: 'Insufficient Studs' }, { status: 409 })
  }

  // Check not already bet on this market+runner
  const { data: existing } = await service
    .from('futures_bets')
    .select('id')
    .eq('user_id', user.id)
    .eq('market', market)
    .eq('runner_id', runner_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'You have already bet on this' }, { status: 409 })
  }

  const potential_payout = Math.floor(wager * marketRow.odds)

  // Insert bet
  const { data: bet, error: betError } = await service
    .from('futures_bets')
    .insert({
      user_id: user.id,
      market,
      runner_id,
      wager,
      odds_at_placement: marketRow.odds,
      potential_payout,
      status: 'pending',
    })
    .select()
    .single()

  if (betError || !bet) {
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 })
  }

  // Deduct Studs
  const { new_balance, error: studsError } = await mutateStuds({
    supabase: service,
    user_id: user.id,
    amount: -wager,
    reason: 'bet_placed',
    ref_id: bet.id,
  })

  if (studsError) {
    await service.from('futures_bets').delete().eq('id', bet.id)
    return NextResponse.json({ error: 'Failed to deduct Studs' }, { status: 500 })
  }

  return NextResponse.json({ bet, new_balance }, { status: 201 })
}