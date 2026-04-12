import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  const service = createServiceClient()

  const { data, error } = await service
    .from('race_runners')
    .select('runner_id, finish_time')
    .not('finish_time', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const toSeconds = (t: string) => {
    const parts = t.split(':').map(Number)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const best: Record<string, string> = {}
  for (const { runner_id, finish_time } of data) {
    if (!best[runner_id] || toSeconds(finish_time) < toSeconds(best[runner_id])) {
      best[runner_id] = finish_time
    }
  }

  return NextResponse.json(best)
}
