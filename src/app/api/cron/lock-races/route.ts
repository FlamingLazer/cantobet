import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const now = new Date().toISOString()

  // Find open races past their scheduled time that haven't been manually unlocked
  const { data: racesToLock, error } = await service
    .from('races')
    .select('id, week, rung')
    .eq('status', 'open')
    .eq('manually_unlocked', false)
    .lt('scheduled_at', now)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!racesToLock || racesToLock.length === 0) {
    return NextResponse.json({ locked: 0 })
  }

  const ids = racesToLock.map((r: { id: string }) => r.id)

  const { error: updateError } = await service
    .from('races')
    .update({ status: 'locked' })
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ locked: racesToLock.length })
}
