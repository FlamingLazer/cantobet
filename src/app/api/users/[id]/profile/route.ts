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

  const [
    { data: userData },
    { data: bets },
    { data: rawFuturePicks },
    { data: futuresLines },
    { data: futuresConfig },
  ] = await Promise.all([
    service.from('users').select('*').eq('id', id).single(),
    betsQuery,
    service.from('ladder_futures_picks').select('id, runner_id, direction, is_correct, points_earned').eq('user_id', id),
    service.from('ladder_futures_lines').select('runner_id, line, final_position, settled_at, runner:runners(username, seed)'),
    service.from('ladder_futures_config').select('is_locked').single(),
  ])

  const futuresLocked = futuresConfig?.is_locked ?? false
  const lineMap = Object.fromEntries((futuresLines ?? []).map((l: { runner_id: string }) => [l.runner_id, l]))

  const futurePicks = (futuresLocked || canSeeAll)
    ? (rawFuturePicks ?? [])
        .map((p: { runner_id: string }) => ({ ...p, line: lineMap[p.runner_id] ?? null }))
        .sort((a: { line?: { runner?: { seed?: number | null } } | null }, b: { line?: { runner?: { seed?: number | null } } | null }) => {
          const sa = a.line?.runner?.seed ?? 999
          const sb = b.line?.runner?.seed ?? 999
          return sa - sb
        })
    : []

  const visibleFuturePicks = futurePicks

  const settledBets = bets?.filter((b: { status: string }) => b.status !== 'pending') ?? []
  const correctBets = settledBets.filter((b: { status: string }) => b.status === 'won')
  const totalPoints = correctBets.reduce((sum: number, b: { points_earned: number | null }) => sum + (b.points_earned ?? 0), 0)
  const accuracy = settledBets.length > 0
    ? Math.round((correctBets.length / settledBets.length) * 100)
    : 0

  const settledFutures = visibleFuturePicks.filter((p: { line?: { settled_at?: string | null } | null }) => p.line?.settled_at)
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
      futures_settled: settledFutures.length,
      futures_total: visibleFuturePicks.length,
      futures_locked: futuresLocked,
      futures_visible: futuresLocked || canSeeAll,
    },
    bets: bets ?? [],
    futures_picks: visibleFuturePicks,
    watch_sessions: [],
  })
}