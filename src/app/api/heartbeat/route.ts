import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'
import { isStreamLive } from '@/lib/twitch'

const STUDS_PER_MINUTE = 10
const MIN_PING_INTERVAL_MS = 50_000

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const streamLive = await isStreamLive()
  if (!streamLive) {
    return NextResponse.json({ stream_live: false, studs_credited: 0, new_balance: null })
  }

  const service = createServiceClient()
  const now = new Date()

  const { data: session } = await service
    .from('watch_sessions')
    .select('*')
    .eq('user_id', user.id)
    .gte('started_at', new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (session) {
    const msSinceLastPing = now.getTime() - new Date(session.last_ping_at).getTime()
    if (msSinceLastPing < MIN_PING_INTERVAL_MS) {
      return NextResponse.json({ stream_live: true, studs_credited: 0, new_balance: null })
    }
  }

  const { new_balance, error } = await mutateStuds({
    supabase: service,
    user_id: user.id,
    amount: STUDS_PER_MINUTE,
    reason: 'watch_time',
    ref_id: session?.id,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to credit Studs' }, { status: 500 })
  }

  if (session) {
    await service
      .from('watch_sessions')
      .update({
        last_ping_at: now.toISOString(),
        studs_credited: session.studs_credited + STUDS_PER_MINUTE,
      })
      .eq('id', session.id)
  } else {
    await service.from('watch_sessions').insert({
      user_id: user.id,
      started_at: now.toISOString(),
      last_ping_at: now.toISOString(),
      studs_credited: STUDS_PER_MINUTE,
    })
  }

  return NextResponse.json({ stream_live: true, studs_credited: STUDS_PER_MINUTE, new_balance })
}