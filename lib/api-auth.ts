import type { SupabaseClient, User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type StaffAuth = { supabase: SupabaseClient; user: User } | { response: Response }

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function hasSupabaseSessionCookie() {
  try {
    const store = await cookies()
    return store.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))
  } catch {
    return false
  }
}

// Never throws: every failure becomes a clean JSON response.
export async function requireProfessorOrAdmin(action: string): Promise<StaffAuth> {
  if (!(await hasSupabaseSessionCookie())) return { response: jsonError(`Sign in to ${action}.`, 401) }

  let supabase: SupabaseClient
  try {
    supabase = await createClient()
  } catch (error) {
    console.error('Supabase server client could not be created:', error)
    return { response: jsonError('Authentication is not configured on the server.', 503) }
  }

  let user: User | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) user = data.user
  } catch (error) {
    console.error('Supabase session check failed:', error)
  }
  if (!user) return { response: jsonError(`Sign in to ${action}.`, 401) }

  try {
    const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (error) {
      console.error('Profile role lookup failed:', error.message)
      return { response: jsonError('Could not verify your account role. Please try again.', 503) }
    }
    const role = typeof profile?.role === 'string' ? profile.role.toLowerCase() : ''
    if (role !== 'professor' && role !== 'admin') {
      return { response: jsonError(`Only professors and administrators can ${action}.`, 403) }
    }
  } catch (error) {
    console.error('Profile role lookup threw:', error)
    return { response: jsonError('Could not verify your account role. Please try again.', 503) }
  }
  return { supabase, user }
}
