import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const json = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()

    if (authError || !auth.user) {
      return json({ error: 'Authentication required.' }, 401)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[documents] profile lookup failed', profileError.message)
      return json({ error: 'Unable to verify account permissions.' }, 503)
    }

    if (!profile || !['professor', 'admin'].includes(profile.role)) {
      return json({ error: 'Professor or admin access required.' }, 403)
    }

    const { data, error } = await supabase
      .from('professor_documents')
      .select('id, title, file_name, file_type, file_size, status, is_shared_with_students, course_id, created_at')
      .eq('professor_id', auth.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[documents] document lookup failed', error.message)
      return json({ error: 'Unable to load source documents.' }, 503)
    }

    return json({ documents: data ?? [] }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[documents] unexpected failure', message)
    if (message.includes('Supabase public environment variables')) {
      return json({ error: 'Supabase is not configured for this deployment.' }, 503)
    }
    return json({ error: 'Unable to load source documents.' }, 500)
  }
}
