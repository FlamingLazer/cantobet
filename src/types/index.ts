export interface User {
  id: string
  twitch_id: string
  twitch_username: string
  avatar_url: string | null
  studs_balance: number
  is_admin: boolean
  created_at: string
}

export interface Runner {
  id: string
  username: string
  character: string
  pb: string
  seed: number
  current_rung: number
  status: 'active' | 'qualified' | 'eliminated'
  country_code?: string | null
}

export interface Race {
  id: string
  week: number
  rung: number
  scheduled_at: string
  status: 'open' | 'locked' | 'settled'
  winner_runner_id: string | null
  is_top8_qualifier: boolean
  manually_unlocked: boolean
}

export interface RaceRunner {
  id: string
  race_id: string
  runner_id: string
  odds: number | null
  finish_position: number | null
  finish_time: string | null
  runner?: Runner
}

export interface RaceWithRunners extends Race {
  race_runners: RaceRunner[]
}

export interface Bet {
  id: string
  user_id: string
  race_runner_id: string
  wager: number
  odds_at_placement: number
  potential_payout: number
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  race_runner?: RaceRunner & { race?: Race }
}

export interface FuturesBet {
  id: string
  user_id: string
  market: 'champion' | 'top8_qualification'
  runner_id: string
  wager: number
  odds_at_placement: number
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  runner?: Runner
}

export interface StudsLedgerEntry {
  id: string
  user_id: string
  amount: number
  reason: 'bet_placed' | 'bet_won' | 'watch_time' | 'signup_bonus' | 'admin_adjustment'
  ref_id: string | null
  created_at: string
}

export interface WatchSession {
  id: string
  user_id: string
  started_at: string
  last_ping_at: string
  studs_credited: number
}

export interface AuditLog {
  id: string
  admin_user_id: string
  action_type: 'race_created' | 'race_deleted' | 'race_settled' | 'odds_updated' | 'studs_adjusted' | 'admin_granted' | 'admin_revoked' | 'futures_odds_updated'
  description: string
  metadata: Record<string, unknown>
  created_at: string
  admin?: User
}

export interface PlaceBetRequest {
  race_runner_id: string
  wager: number
}

export interface PlaceBetResponse {
  bet: Bet
  new_balance: number
}

export interface SettleRaceRequest {
  race_id: string
  results: {
    race_runner_id: string
    finish_position: 1 | 2 | 3
    finish_time: string
  }[]
}

export interface UserProfileStats {
  studs_balance: number
  bet_profit_loss: number
  watch_studs_earned: number
  total_watch_minutes: number
  bets: Bet[]
  watch_sessions: WatchSession[]
}

export interface HeartbeatResponse {
  stream_live: boolean
  studs_credited: number
  new_balance: number
}