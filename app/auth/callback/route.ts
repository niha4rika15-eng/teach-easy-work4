import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')

  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=confirmation_failed', url.origin))

  const role = data.user?.user_metadata?.role === 'professor' ? 'professor' : 'student'
  return NextResponse.redirect(new URL(next === '/professor' || next === '/student' ? next : `/${role}`, url.origin))
}
