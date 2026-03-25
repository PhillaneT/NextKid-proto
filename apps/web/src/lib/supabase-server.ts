import { createClient } from '@supabase/supabase-js'

// RULE: Never import this in client components — service role key must never reach the browser.
// This client bypasses RLS and is for server-side API routes only.
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
