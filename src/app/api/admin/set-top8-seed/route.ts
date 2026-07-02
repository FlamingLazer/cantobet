import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { runner_id, top8_seed } = await req.json()
  if (!runner_id) return NextResponse.json({ error: 'runner_id required' }, { status: 400 })
  if (top8_seed !== null && (typeof top8_seed !== 'number' || top8_seed < 1 || top8_seed > 8)) {
    return NextResponse.json({ error: 'top8_seed must be 1–8 or null' }, { status: 400 })
  }

  const { error } = await service
    .from('runners')
    .update({ top8_seed })
    .eq('id', runner_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'runner_updated',
    description: `Set top8_seed=${top8_seed} for runner ${runner_id}`,
    metadata: { runner_id, top8_seed },
  })

  return NextResponse.json({ ok: true })
}
