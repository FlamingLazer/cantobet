import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { picks, wager, combined_odds } = body

  if (!picks?.length || picks.length < 2 || !wager || wager < 10) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()

  // Check balance
  const { data: profile } = await service
    .from('users')
    .select('studs_balance')
    .eq('id', user.id)
    .single()

  if (!profile || profile.studs_balance < wager) {
    return NextResponse.json({ error: 'Insufficient Studs' }, { status: 409 })
  }

  // Validate all picks are open races
  for (const pick of picks) {
    const { data: rr } = await service
      .from('race_runners')
      .select('*, race:races(status, scheduled_at)')
      .eq('id', pick.id)
      .single()

    if (!rr) return NextResponse.json({ error: `Pick not found: ${pick.id}` }, { status: 404 })
    if (rr.race.status !== 'open') return NextResponse.json({ error: 'One or more races are locked' }, { status: 409 })
    if (new Date(rr.race.scheduled_at) <= new Date()) return NextResponse.json({ error: 'One or more races have started' }, { status: 409 })
  }

  const potential_payout = Math.floor(wager * combined_odds)

  // Insert parlay bet
  const { data: bet, error: betError } = await service
    .from('parlay_bets')
    .insert({
      user_id: user.id,
      wager,
      combined_odds,
      potential_payout,
      status: 'pending',
      legs: picks.map((p: { id: string; odds: number }) => ({
        race_runner_id: p.id,
        odds: p.odds,
      })),
    })
    .select()
    .single()

  if (betError || !bet) {
    return NextResponse.json({ error: 'Failed to place parlay' }, { status: 500 })
  }

  const { new_balance, error: studsError } = await mutateStuds({
    supabase: service,
    user_id: user.id,
    amount: -wager,
    reason: 'bet_placed',
    ref_id: bet.id,
  })

  if (studsError) {
    await service.from('parlay_bets').delete().eq('id', bet.id)
    return NextResponse.json({ error: 'Failed to deduct Studs' }, { status: 500 })
  }

  return NextResponse.json({ bet, new_balance }, { status: 201 })
}