import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const service = createServiceClient()

  const [configRes, linesRes] = await Promise.all([
    service.from('ladder_futures_config').select('*').single(),
    service.from('ladder_futures_lines').select(`
      id, runner_id, line, final_position, settled_at,
      runner:runners(id, username, current_rung, seed, status)
    `).order('line'),
  ])

  const config = configRes.data ?? { is_locked: false, points_per_correct_pick: 100 }
  const lines = linesRes.data ?? []

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let picks: { runner_id: string; direction: string; is_correct: boolean | null }[] = []
  if (user) {
    const { data } = await service
      .from('ladder_futures_picks')
      .select('runner_id, direction, is_correct')
      .eq('user_id', user.id)
    picks = data ?? []
  }

  return NextResponse.json({ config, lines, picks })
}
