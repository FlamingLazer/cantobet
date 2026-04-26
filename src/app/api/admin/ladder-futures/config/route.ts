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
  const update: Record<string, unknown> = {}

  if (typeof body.is_locked === 'boolean') update.is_locked = body.is_locked
  if (typeof body.points_per_correct_pick === 'number') update.points_per_correct_pick = body.points_per_correct_pick

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await service.from('ladder_futures_config').update(update).eq('id', 1)
  if (error) return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })

  const desc = Object.entries(update).map(([k, v]) => `${k}=${v}`).join(', ')
  if (userId) await writeAuditLog({ admin_user_id: userId, action_type: 'futures_config_updated', description: `Ladder futures config updated: ${desc}` })

  return NextResponse.json({ ok: true })
}
