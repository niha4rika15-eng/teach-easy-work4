import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const APPS_SCRIPT_FALLBACK_URL =
  'https://script.google.com/macros/s/AKfycbw5g5x2IiJMpI7GBrKRHfqhrmP4toxnPeLXzt78eod_b9XqEY6CQphgPE1iW_Gu0voM/exec'

const publishSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  questions: z.array(z.object({
    question: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
    correctAnswer: z.string().trim().min(1).max(500),
    points: z.number().int().min(1).max(100).default(1),
  })).min(1).max(50),
})

function getGoogleFormUrl(payload: unknown, keys: string[]) {
  if (typeof payload !== 'object' || payload === null) return null
  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key]
    if (typeof value !== 'string') continue
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && ['docs.google.com', 'forms.gle'].includes(url.hostname)) {
        return url.toString()
      }
    } catch {
      continue
    }
  }
  return null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return Response.json({ error: 'Authentication is required to publish a form.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (profileError) throw new Error(`Could not verify the current user role: ${profileError.message}`)
    if (profile?.role !== 'professor' && profile?.role !== 'admin') {
      return Response.json({ error: 'Only professors and administrators can publish Google Forms.' }, { status: 403 })
    }

    let rawInput: unknown
    try {
      rawInput = await request.json()
    } catch {
      return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
    }
    const parsedInput = publishSchema.safeParse(rawInput)
    if (!parsedInput.success) {
      return Response.json({ error: parsedInput.error.issues[0]?.message ?? 'Invalid form payload.' }, { status: 400 })
    }
    const { questions, ...form } = parsedInput.data
    for (const question of questions) {
      if (!question.options.includes(question.correctAnswer)) {
        return Response.json({ error: 'Each correctAnswer must match one of its question options.' }, { status: 400 })
      }
    }

    const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL || APPS_SCRIPT_FALLBACK_URL
    const endpointUrl = new URL(endpoint)
    if (endpointUrl.protocol !== 'https:' || endpointUrl.hostname !== 'script.google.com') {
      throw new Error('GOOGLE_APPS_SCRIPT_URL must be an HTTPS Google Apps Script URL.')
    }

    const webhookResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, questions }),
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    })
    const responseText = await webhookResponse.text()
    if (!webhookResponse.ok) {
      return Response.json(
        { error: `Google Forms publishing failed with status ${webhookResponse.status}.` },
        { status: 502 },
      )
    }

    let webhookPayload: unknown
    try {
      webhookPayload = JSON.parse(responseText)
    } catch {
      return Response.json({ error: 'The Apps Script response was not valid JSON.' }, { status: 502 })
    }
    if (
      typeof webhookPayload === 'object' &&
      webhookPayload !== null &&
      'success' in webhookPayload &&
      (webhookPayload as { success?: unknown }).success === false
    ) {
      return Response.json({ error: 'The Apps Script did not create the Google Form.' }, { status: 502 })
    }

    const formUrl = getGoogleFormUrl(webhookPayload, ['formUrl', 'studentQuizLink', 'studentUrl', 'publishedUrl', 'url'])
    const editUrl = getGoogleFormUrl(webhookPayload, ['editUrl', 'professorResultsLink', 'editorUrl'])
    if (!formUrl) {
      return Response.json({ error: 'The Apps Script response did not contain a valid Google Form URL.' }, { status: 502 })
    }
    const { error: saveError } = await supabase.from('quizzes').insert({
      professor_id: authData.user.id,
      title: form.title,
      student_quiz_url: formUrl,
      professor_results_url: editUrl,
    })
    return Response.json({
      formUrl,
      editUrl,
      warning: saveError ? `The form was created, but its links could not be saved to the quiz list: ${saveError.message}` : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Google Forms publishing error.'
    return Response.json({ error: message }, { status: 500 })
  }
}
