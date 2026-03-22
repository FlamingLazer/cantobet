import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id, is_admin } = await req.json()

  if (!user_id || typeof is_admin !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { error } = await service
    .from('users')
    .update({ is_admin })
    .eq('id', user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: targetUser } = await service
    .from('users')
    .select('twitch_username')
    .eq('id', user_id)
    .single()

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: is_admin ? 'admin_granted' : 'admin_revoked',
    description: `${is_admin ? 'Granted' : 'Revoked'} admin access for ${targetUser?.twitch_username ?? user_id}`,
    metadata: { user_id, is_admin },
  })

  return NextResponse.json({ success: true })
}