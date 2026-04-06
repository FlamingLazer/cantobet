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
  ] = await Promise.all([
    service.from('users').select('*').eq('id', id).single(),
    service
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
      .order('placed_at', { ascending: false }),
  ])

  const settledBets = bets?.filter((b: { status: string }) => b.status !== 'pending') ?? []
  const correctBets = settledBets.filter((b: { status: string }) => b.status === 'won')
  const totalPoints = correctBets.reduce((sum: number, b: { points_earned: number | null }) => sum + (b.points_earned ?? 0), 0)
  const accuracy = settledBets.length > 0
    ? Math.round((correctBets.length / settledBets.length) * 100)
    : 0

  return NextResponse.json({
    user: userData,
    stats: {
      points: userData?.points ?? 0,
      total_correct: correctBets.length,
      total_predictions: settledBets.length,
      accuracy,
    },
    bets: bets ?? [],
    futures_bets: [],
    parlay_bets: [],
    watch_sessions: [],
  })
}