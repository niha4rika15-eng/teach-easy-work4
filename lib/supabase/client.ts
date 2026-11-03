'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_NOT_CONFIGURED = 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.';

export function createClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) throw new Error(SUPABASE_NOT_CONFIGURED);
  return createBrowserClient(supabaseUrl, supabaseKey);
}

// Missing config fails on use (inside try/catch) instead of crashing every page at import time.
function createUnconfiguredClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(SUPABASE_NOT_CONFIGURED);
    },
  });
}

export const supabase: SupabaseClient = supabaseUrl && supabaseKey ? createClient() : createUnconfiguredClient();
