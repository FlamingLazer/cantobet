import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/audit'
import { season3 } from '@/lib/participants'

function normalizeCountry(country: string): string {
  if (country === 'UK') return 'GB'
  return country
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = season3.map(p => ({
    username: p.name,
    seed: p.seed,
    country_code: normalizeCountry(p.country),
    status: 'active',
  }))

  const { error } = await service
    .from('runners')
    .upsert(rows, { onConflict: 'username', ignoreDuplicates: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'runners_seeded',
    description: `Seeded ${rows.length} runners from participants list.`,
    metadata: { count: rows.length },
  })

  return NextResponse.json({ seeded: rows.length })
}
