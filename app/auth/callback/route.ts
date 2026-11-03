import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardPath } from '@/lib/types'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=confirmation_failed', url.origin))

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profileError || !profile) {
    return NextResponse.redirect(new URL('/login?error=profile_unavailable', url.origin))
  }

  return NextResponse.redirect(new URL(getDashboardPath(profile.role), url.origin))
}
