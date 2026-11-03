import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createDocx, createPdf, createPptx } from '@/lib/exporters'

export const runtime = 'nodejs'
export const maxDuration = 60

const querySchema = z.object({
  generation_id: z.string().uuid(),
  format: z.enum(['pdf', 'docx', 'pptx']),
})

const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const

export async function GET(request: Request) {
  try {
    const params = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!params.success) {
      return Response.json({ error: 'A valid generation_id and export format are required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return Response.json({ error: 'Sign in to export generated content.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (profileError) throw new Error(`Could not verify the current user role: ${profileError.message}`)
    if (profile?.role !== 'professor' && profile?.role !== 'admin') {
      return Response.json({ error: 'Only professors and administrators can export generated content.' }, { status: 403 })
    }

    const { data: generation, error: generationError } = await supabase
      .from('generations')
      .select('id, template_type, target_language, generated_text')
      .eq('id', params.data.generation_id)
      .eq('user_id', authData.user.id)
      .maybeSingle()
    if (generationError) throw new Error(`Could not load generated content: ${generationError.message}`)
    if (!generation?.generated_text) {
      return Response.json({ error: 'Generated content was not found or is not owned by you.' }, { status: 404 })
    }
    if (generation.generated_text.length > 200_000) {
      return Response.json({ error: 'Generated content is too large to export.' }, { status: 413 })
    }

    const title = `${generation.template_type.replace(/_/g, ' ')} (${generation.target_language})`
    const format = params.data.format
    let output: Buffer
    if (format === 'docx') output = await createDocx(title, generation.generated_text)
    else if (format === 'pdf') output = await createPdf(title, generation.generated_text)
    else output = await createPptx(title, generation.generated_text)

    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': MIME_TYPES[format],
        'Content-Disposition': `attachment; filename="teach-easy-${generation.id}.${format}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected export error.'
    return Response.json({ error: message }, { status: 500 })
  }
}
