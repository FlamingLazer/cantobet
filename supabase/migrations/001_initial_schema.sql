create extension if not exists "uuid-ossp";

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  twitch_id       text unique not null,
  twitch_username text not null,
  avatar_url      text,
  studs_balance   integer not null default 5000,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, twitch_id, twitch_username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.studs_ledger (user_id, amount, reason)
  values (new.id, 5000, 'signup_bonus');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.runners (
  id            uuid primary key default uuid_generate_v4(),
  username      text unique not null,
  character     text not null,
  pb            interval not null,
  seed          integer,
  current_rung  integer not null default 1,
  status        text not null default 'active'
    check (status in ('active', 'qualified', 'eliminated'))
);

create table public.races (
  id                uuid primary key default uuid_generate_v4(),
  week              integer not null,
  rung              integer not null,
  scheduled_at      timestamptz not null,
  status            text not null default 'open'
    check (status in ('open', 'locked', 'settled')),
  winner_runner_id  uuid references public.runners(id),
  is_top8_qualifier boolean not null default false,
  created_at        timestamptz not null default now()
);

create index races_week_idx on public.races(week);
create index races_status_idx on public.races(status);

create table public.race_runners (
  id               uuid primary key default uuid_generate_v4(),
  race_id          uuid not null references public.races(id) on delete cascade,
  runner_id        uuid not null references public.runners(id),
  odds             numeric(5,2),
  finish_position  integer check (finish_position in (1, 2, 3)),
  finish_time      interval,
  unique(race_id, runner_id)
);

create index race_runners_race_id_idx on public.race_runners(race_id);

create table public.bets (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  race_runner_id      uuid not null references public.race_runners(id),
  wager               integer not null check (wager >= 10),
  odds_at_placement   numeric(5,2) not null,
  potential_payout    integer not null,
  status              text not null default 'pending'
    check (status in ('pending', 'won', 'lost')),
  placed_at           timestamptz not null default now()
);

create index bets_user_id_idx on public.bets(user_id);
create index bets_race_runner_id_idx on public.bets(race_runner_id);

create table public.futures_bets (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  market              text not null check (market in ('champion', 'top8_qualification')),
  runner_id           uuid not null references public.runners(id),
  wager               integer not null check (wager >= 10),
  odds_at_placement   numeric(5,2) not null,
  status              text not null default 'pending'
    check (status in ('pending', 'won', 'lost')),
  placed_at           timestamptz not null default now()
);

create index futures_bets_user_id_idx on public.futures_bets(user_id);

create table public.studs_ledger (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  amount      integer not null,
  reason      text not null
    check (reason in ('bet_placed', 'bet_won', 'watch_time', 'signup_bonus', 'admin_adjustment')),
  ref_id      uuid,
  created_at  timestamptz not null default now()
);

create index studs_ledger_user_id_idx on public.studs_ledger(user_id);

create table public.watch_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  last_ping_at    timestamptz not null default now(),
  studs_credited  integer not null default 0
);

create index watch_sessions_user_id_idx on public.watch_sessions(user_id);

create table public.audit_log (
  id              uuid primary key default uuid_generate_v4(),
  admin_user_id   uuid not null references public.users(id),
  action_type     text not null
    check (action_type in (
      'race_created', 'race_deleted', 'race_settled',
      'odds_updated', 'studs_adjusted',
      'admin_granted', 'admin_revoked',
      'futures_odds_updated'
    )),
  description     text not null,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index audit_log_admin_user_id_idx on public.audit_log(admin_user_id);
create index audit_log_action_type_idx on public.audit_log(action_type);
create index audit_log_created_at_idx on public.audit_log(created_at desc);

create or replace function public.mutate_studs(
  p_user_id  uuid,
  p_amount   integer,
  p_reason   text,
  p_ref_id   uuid default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_balance integer;
begin
  update public.users
  set studs_balance = studs_balance + p_amount
  where id = p_user_id
  returning studs_balance into v_new_balance;

  if v_new_balance < 0 then
    raise exception 'Insufficient Studs';
  end if;

  insert into public.studs_ledger (user_id, amount, reason, ref_id)
  values (p_user_id, p_amount, p_reason, p_ref_id);

  return v_new_balance;
end;
$$;

alter table public.users enable row level security;
alter table public.runners enable row level security;
alter table public.races enable row level security;
alter table public.race_runners enable row level security;
alter table public.bets enable row level security;
alter table public.futures_bets enable row level security;
alter table public.studs_ledger enable row level security;
alter table public.watch_sessions enable row level security;
alter table public.audit_log enable row level security;

create policy "users_read_all" on public.users for select using (true);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "runners_read_all" on public.runners for select using (true);
create policy "races_read_all" on public.races for select using (true);
create policy "race_runners_read_all" on public.race_runners for select using (true);
create policy "bets_read_own" on public.bets for select using (auth.uid() = user_id);
create policy "bets_insert_own" on public.bets for insert with check (auth.uid() = user_id);
create policy "futures_bets_read_own" on public.futures_bets for select using (auth.uid() = user_id);
create policy "futures_bets_insert_own" on public.futures_bets for insert with check (auth.uid() = user_id);
create policy "ledger_read_own" on public.studs_ledger for select using (auth.uid() = user_id);
create policy "watch_sessions_read_own" on public.watch_sessions for select using (auth.uid() = user_id);
create policy "audit_log_admin_read" on public.audit_log
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );