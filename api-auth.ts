import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createRequestClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public environment variables are not configured.');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

function getBearerToken(req: NextRequest) {
  return req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export async function getUserFromRequest(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await createRequestClient(token).auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function getProfileFromRequest(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await createRequestClient(token).from('profiles').select('id,email,full_name,role,department,teaching_level,teaching_style,primary_goal,onboarding_completed,training_opt_in,created_at,updated_at').eq('id', user.id).maybeSingle();
  if (error) throw new Error(`Failed to load authenticated profile: ${error.message}`);
  return data;
}

export function requireRole(req: NextRequest, roles: string[]) {
  return async () => {
    const profile = await getProfileFromRequest(req);
    if (!profile || !roles.map((role) => role.toLowerCase()).includes((profile.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return profile;
  };
}

export async function logUsage(req: NextRequest, userId: string, eventType: string, eventData: Record<string, unknown> = {}, timeSaved = 0) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Cannot record usage without an authenticated bearer token.');
  const client = createRequestClient(token);
  const writes = [
    client.from('usage_logs').insert({
      user_id: userId,
      action: eventType,
      route: new URL(req.url).pathname,
      metadata: eventData,
    }),
  ];
  if (timeSaved > 0) {
    writes.push(client.from('usage_telemetry').insert({
      user_id: userId,
      feature_name: eventType,
      estimated_time_saved_minutes: timeSaved,
    }));
  }
  const results = await Promise.all(writes);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(`Failed to record usage: ${error.message}`);
}
