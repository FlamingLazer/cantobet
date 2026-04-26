import { createServiceClient } from './supabase-server'

interface AuditParams {
  admin_user_id: string
  action_type:
    | 'race_created'
    | 'race_deleted'
    | 'race_settled'
    | 'odds_updated'
    | 'studs_adjusted'
    | 'admin_granted'
    | 'admin_revoked'
    | 'futures_odds_updated'
    | 'race_locked'
    | 'race_unlocked'
    | 'pbs_synced'
    | 'runners_seeded'
    | 'futures_config_updated'
    | 'futures_line_set'
    | 'futures_settled'
  description: string
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(params: AuditParams) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('audit_log').insert({
    admin_user_id: params.admin_user_id,
    action_type: params.action_type,
    description: params.description,
    metadata: params.metadata ?? {},
  })
  if (error) {
    console.error('Audit log write failed:', error)
  }
}