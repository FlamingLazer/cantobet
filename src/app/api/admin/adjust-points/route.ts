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
    .select('is_admin, twitch_username')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id, amount, reason } = await req.json()

  if (!user_id || !amount || !reason) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: newPoints, error } = await service.rpc('credit_points', {
    p_user_id: user_id,
    p_points: amount,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'studs_adjusted',
    description: `Manual Points adjustment: ${amount > 0 ? '+' : ''}${amount} to user. Reason: "${reason}".`,
    metadata: { user_id, amount, reason },
  })

  return NextResponse.json({ new_balance: newPoints })
}
