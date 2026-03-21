import { SupabaseClient } from '@supabase/supabase-js'

interface MutateStudsParams {
  supabase: SupabaseClient
  user_id: string
  amount: number
  reason: 'bet_placed' | 'bet_won' | 'watch_time' | 'signup_bonus' | 'admin_adjustment'
  ref_id?: string
}

export async function mutateStuds({
  supabase,
  user_id,
  amount,
  reason,
  ref_id,
}: MutateStudsParams): Promise<{ new_balance: number; error: string | null }> {
  const { data, error } = await supabase.rpc('mutate_studs', {
    p_user_id: user_id,
    p_amount: amount,
    p_reason: reason,
    p_ref_id: ref_id ?? null,
  })

  if (error) {
    return { new_balance: 0, error: error.message }
  }

  return { new_balance: data as number, error: null }
}