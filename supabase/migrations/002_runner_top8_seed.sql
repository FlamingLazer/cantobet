alter table public.runners add column if not exists top8_seed integer;

alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check (action_type in (
  'race_created', 'race_deleted', 'race_settled',
  'odds_updated', 'studs_adjusted',
  'admin_granted', 'admin_revoked',
  'futures_odds_updated',
  'race_locked', 'race_unlocked',
  'pbs_synced', 'runners_seeded',
  'futures_config_updated', 'futures_line_set', 'futures_settled',
  'runner_updated'
));
