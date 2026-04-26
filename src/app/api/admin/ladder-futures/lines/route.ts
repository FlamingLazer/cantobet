import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const service = createServiceClient()
  let userId: string | null = null

  if (process.env.NODE_ENV !== 'development') {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await service.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    userId = user.id
  }

  const body = await req.json()
  const { runner_id, line } = body

  if (!runner_id || typeof line !== 'number') {
    return NextResponse.json({ error: 'runner_id and line required' }, { status: 400 })
  }

  const { data: runner } = await service.from('runners').select('username').eq('id', runner_id).single()
  if (!runner) return NextResponse.json({ error: 'Runner not found' }, { status: 404 })

  const { error } = await service
    .from('ladder_futures_lines')
    .upsert({ runner_id, line }, { onConflict: 'runner_id' })

  if (error) return NextResponse.json({ error: 'Failed to set line' }, { status: 500 })

  if (userId) await writeAuditLog({ admin_user_id: userId, action_type: 'futures_line_set', description: `Set futures line for ${runner.username}: ${line}` })

  return NextResponse.json({ ok: true })
}
