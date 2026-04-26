import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient()

  const isOwnProfile = user?.id === id

  let isViewerAdmin = false
  if (user && !isOwnProfile) {
    const { data: viewerProfile } = await service.from('users').select('is_admin').eq('id', user.id).single()
    isViewerAdmin = viewerProfile?.is_admin ?? false
  }
  const canSeeAll = isOwnProfile || isViewerAdmin

  const betsQuery = service
    .from('bets')
    .select(`
      id, odds_at_placement, points_earned, status, placed_at,
      race_runner:race_runners(
        odds,
        runner:runners(username, character, country_code),
        race:races(week, rung, status, scheduled_at)
      )
    `)
    .eq('user_id', id)
    .order('placed_at', { ascending: false })

  if (!canSeeAll) {
    betsQuery.neq('status', 'pending')
  }

  const futuresQuery = service
    .from('ladder_futures_picks')
    .select(`
      id, runner_id, direction, is_correct, points_earned,
      line:ladder_futures_lines(line, final_position, settled_at,
        runner:runners(username)
      )
    `)
    .eq('user_id', id)

  if (!canSeeAll) {
    futuresQuery.not('line.settled_at', 'is', null)
  }

  const [
    { data: userData },
    { data: bets },
    { data: futurePicks },
  ] = await Promise.all([
    service.from('users').select('*').eq('id', id).single(),
    betsQuery,
    futuresQuery,
  ])

  const settledBets = bets?.filter((b: { status: string }) => b.status !== 'pending') ?? []
  const correctBets = settledBets.filter((b: { status: string }) => b.status === 'won')
  const totalPoints = correctBets.reduce((sum: number, b: { points_earned: number | null }) => sum + (b.points_earned ?? 0), 0)
  const accuracy = settledBets.length > 0
    ? Math.round((correctBets.length / settledBets.length) * 100)
    : 0

  const settledFutures = (futurePicks ?? []).filter((p: { line?: { settled_at?: string | null } | null }) => p.line?.settled_at)
  const correctFutures = settledFutures.filter((p: { is_correct?: boolean | null }) => p.is_correct === true)
  const futuresPts = correctFutures.reduce((sum: number, p: { points_earned?: number | null }) => sum + (p.points_earned ?? 0), 0)

  return NextResponse.json({
    user: userData,
    stats: {
      points: userData?.points ?? 0,
      total_correct: correctBets.length,
      total_predictions: settledBets.length,
      accuracy,
      race_points: totalPoints,
      futures_points: futuresPts,
      futures_correct: correctFutures.length,
      futures_total: settledFutures.length,
    },
    bets: bets ?? [],
    futures_picks: futurePicks ?? [],
    watch_sessions: [],
  })
}