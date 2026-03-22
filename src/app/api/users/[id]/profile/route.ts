import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  if (id !== user.id) {
    const { data: profile } = await service
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const [
    { data: userData },
    { data: bets },
    { data: futuresBets },
    { data: parlayBets },
    { data: watchSessions },
    { data: ledger },
  ] = await Promise.all([
    service.from('users').select('*').eq('id', id).single(),
    service
      .from('bets')
      .select(`*, race_runner:race_runners(id, odds, runner:runners(username, character), race:races(week, rung, status, scheduled_at))`)
      .eq('user_id', id)
      .order('placed_at', { ascending: false }),
    service
      .from('futures_bets')
      .select('*, runner:runners(username, character)')
      .eq('user_id', id)
      .order('placed_at', { ascending: false }),
    service
      .from('parlay_bets')
      .select('*')
      .eq('user_id', id)
      .order('placed_at', { ascending: false }),
    service
      .from('watch_sessions')
      .select('*')
      .eq('user_id', id)
      .order('started_at', { ascending: false }),
    service
      .from('studs_ledger')
      .select('amount, reason')
      .eq('user_id', id),
  ])

  const watchStudsEarned = ledger
    ?.filter((e: { reason: string }) => e.reason === 'watch_time')
    .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0) ?? 0

  const settledBets = bets?.filter((b: { status: string }) => b.status !== 'pending') ?? []
  const settledWagered = settledBets.reduce((sum: number, b: { wager: number }) => sum + b.wager, 0)
  const settledWon = settledBets
    .filter((b: { status: string }) => b.status === 'won')
    .reduce((sum: number, b: { potential_payout: number }) => sum + b.potential_payout, 0)

  const settledParlays = parlayBets?.filter((b: { status: string }) => b.status !== 'pending') ?? []
  const settledParlayWagered = settledParlays.reduce((sum: number, b: { wager: number }) => sum + b.wager, 0)
  const settledParlayWon = settledParlays
    .filter((b: { status: string }) => b.status === 'won')
    .reduce((sum: number, b: { potential_payout: number }) => sum + b.potential_payout, 0)

  const betProfitLoss = (settledWon - settledWagered) + (settledParlayWon - settledParlayWagered)

  const totalWatchMinutes = watchSessions
    ?.reduce((sum: number, s: { studs_credited: number }) => sum + s.studs_credited / 10, 0) ?? 0

  return NextResponse.json({
    user: userData,
    stats: {
      studs_balance: userData?.studs_balance ?? 0,
      bet_profit_loss: betProfitLoss,
      watch_studs_earned: watchStudsEarned,
      total_watch_minutes: Math.round(totalWatchMinutes),
    },
    bets: bets ?? [],
    futures_bets: futuresBets ?? [],
    parlay_bets: parlayBets ?? [],
    watch_sessions: watchSessions ?? [],
  })
}