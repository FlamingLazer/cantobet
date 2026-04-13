import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
import { mutateStuds } from '@/lib/studs'
import { writeAuditLog } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data: race } = await service
    .from('races')
    .select('week, rung, status')
    .eq('id', id)
    .single()

  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })
  if (race.status === 'settled') {
    return NextResponse.json({ error: 'Cannot delete a settled race — use Unsettle first' }, { status: 409 })
  }

  // Get all race_runner IDs
  const { data: raceRunners } = await service
    .from('race_runners')
    .select('id')
    .eq('race_id', id)

  const raceRunnerIds = raceRunners?.map((r: { id: string }) => r.id) ?? []

  // Find pending bets and refund wagers
  if (raceRunnerIds.length > 0) {
    const { data: bets } = await service
      .from('bets')
      .select('id, user_id, wager, status')
      .in('race_runner_id', raceRunnerIds)
      .eq('status', 'pending')

    if (bets?.length) {
      for (const bet of bets) {
        // Refund the wager
        await mutateStuds({
          supabase: service,
          user_id: bet.user_id,
          amount: bet.wager,
          reason: 'admin_adjustment',
          ref_id: bet.id,
        })
      }

      // Delete the bets
      await service
        .from('bets')
        .delete()
        .in('race_runner_id', raceRunnerIds)
    }
  }

  // Delete race (race_runners cascade via ON DELETE CASCADE)
  const { error } = await service.from('races').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'race_deleted',
    description: `Deleted W${race.week} · Rung ${race.rung} (was ${race.status}) — pending bets refunded.`,
    metadata: { race_id: id, week: race.week, rung: race.rung },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const body = await req.json()
  const { scheduled_at, odds, status } = body

  // Lock: open → locked
  if (status === 'locked') {
    const { data: race } = await service
      .from('races')
      .select('week, rung, status')
      .eq('id', id)
      .single()

    if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })
    if (race.status !== 'open') {
      return NextResponse.json({ error: 'Only open races can be locked' }, { status: 409 })
    }

    const { error } = await service
      .from('races')
      .update({ status: 'locked', manually_unlocked: false })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      admin_user_id: user.id,
      action_type: 'race_locked',
      description: `Locked W${race.week} · Rung ${race.rung} — predictions closed`,
      metadata: { race_id: id, week: race.week, rung: race.rung },
    })

    return NextResponse.json({ success: true })
  }

  // Unlock: locked → open
  if (status === 'open') {
    const { data: race } = await service
      .from('races')
      .select('week, rung, status')
      .eq('id', id)
      .single()

    if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })
    if (race.status !== 'locked') {
      return NextResponse.json({ error: 'Only locked races can be unlocked' }, { status: 409 })
    }

    const { error } = await service
      .from('races')
      .update({ status: 'open', manually_unlocked: true })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      admin_user_id: user.id,
      action_type: 'race_unlocked',
      description: `Unlocked W${race.week} · Rung ${race.rung} — race reopened for predictions`,
      metadata: { race_id: id, week: race.week, rung: race.rung },
    })

    return NextResponse.json({ success: true })
  }

  if (scheduled_at) {
    await service
      .from('races')
      .update({ scheduled_at })
      .eq('id', id)
  }

  if (odds) {
    for (const [rrId, val] of Object.entries(odds)) {
      const parsed = parseFloat(val as string)
      if (!isNaN(parsed)) {
        await service
          .from('race_runners')
          .update({ odds: parsed })
          .eq('id', rrId)
      }
    }
  }

  await writeAuditLog({
    admin_user_id: user.id,
    action_type: 'odds_updated',
    description: `Updated race W— odds/time for race ${id}`,
    metadata: { race_id: id, scheduled_at, odds },
  })

  return NextResponse.json({ success: true })
}