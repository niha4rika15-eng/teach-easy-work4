import { z } from 'zod'
import { jsonError, requireProfessorOrAdmin } from '@/lib/api-auth'
import { parseQuizJson, quizSchema } from '@/lib/quiz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const publishSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  generation_id: z.string().uuid().optional(),
  questions: quizSchema.shape.questions.optional(),
})

const NOT_CONFIGURED = 'Google Forms publishing is not configured. Set GOOGLE_APPS_SCRIPT_URL to your deployed Apps Script web app URL (https://script.google.com/macros/s/.../exec).'

function getAppsScriptUrl(): URL | null {
  const value = process.env.GOOGLE_APPS_SCRIPT_URL?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'script.google.com' ? url : null
  } catch {
    return null
  }
}

function findGoogleFormUrl(payload: Record<string, unknown>, keys: string[], kind: 'student' | 'editor') {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value !== 'string') continue
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:') continue
      if (kind === 'student' && url.hostname === 'forms.gle') return url.toString()
      if (url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')) {
        if (kind === 'editor' && !/\/edit/.test(url.pathname)) continue
        return url.toString()
      }
    } catch {
      continue
    }
  }
  return null
}

export async function POST(request: Request) {
  const auth = await requireProfessorOrAdmin('publish Google Forms')
  if ('response' in auth) return auth.response

  const endpointUrl = getAppsScriptUrl()
  if (!endpointUrl) return jsonError(NOT_CONFIGURED, 503, { code: 'apps_script_not_configured' })

  try {
    let rawInput: unknown
    try {
      rawInput = await request.json()
    } catch {
      return jsonError('Request body must be valid JSON.', 400)
    }
    const parsedInput = publishSchema.safeParse(rawInput)
    if (!parsedInput.success) return jsonError(parsedInput.error.issues[0]?.message ?? 'Invalid form payload.', 400)

    const { generation_id: generationId, questions: providedQuestions, ...form } = parsedInput.data
    let questions = providedQuestions
    if (!questions && generationId) {
      const { data: generation, error: generationError } = await auth.supabase
        .from('generations')
        .select('generated_text, template_type')
        .eq('id', generationId)
        .eq('user_id', auth.user.id)
        .maybeSingle()
      if (generationError) {
        console.error('Quiz lookup failed:', generationError.message)
        return jsonError('Could not load the generated quiz. Please try again.', 503)
      }
      if (!generation?.generated_text) return jsonError('The generated quiz could not be found.', 404)
      if (generation.template_type !== 'quiz') return jsonError('Only quiz generations can be published as Google Forms.', 400)

      const parsedQuiz = parseQuizJson(generation.generated_text)
      if ('error' in parsedQuiz) return jsonError(`Generated quiz cannot be published: ${parsedQuiz.error}`, 400)
      questions = parsedQuiz.quiz.questions
    }
    if (!questions) return jsonError('Provide quiz questions or a generated quiz ID.', 400)

    let webhookResponse: Response
    try {
      webhookResponse = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, questions }),
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      console.error('Apps Script request failed:', error)
      return jsonError('Could not reach the Google Apps Script publishing service.', 502)
    }
    const responseText = await webhookResponse.text()
    if (!webhookResponse.ok) return jsonError(`Google Forms publishing failed with status ${webhookResponse.status}.`, 502)

    let payload: unknown
    try {
      payload = JSON.parse(responseText)
    } catch {
      return jsonError('The Apps Script response was not valid JSON. Check that the web app is deployed with access for "Anyone".', 502)
    }
    if (typeof payload !== 'object' || payload === null) return jsonError('The Apps Script returned an unexpected response.', 502)
    const result = payload as Record<string, unknown>
    if (result.success === false) {
      const detail = typeof result.error === 'string' ? `: ${result.error.slice(0, 300)}` : ''
      return jsonError(`The Apps Script did not create the Google Form${detail}`, 502)
    }

    const formUrl = findGoogleFormUrl(result, ['formUrl', 'studentQuizLink', 'studentUrl', 'publishedUrl', 'url'], 'student')
    const editUrl = findGoogleFormUrl(result, ['editUrl', 'professorResultsLink', 'editorUrl'], 'editor')
    if (!formUrl || !editUrl) {
      return jsonError('The Apps Script response did not include both a valid student link and editor link for the Google Form.', 502)
    }

    const { error: saveError } = await auth.supabase.from('quiz_forms').insert({
      user_id: auth.user.id,
      generation_id: generationId ?? null,
      title: form.title,
      student_quiz_link: formUrl,
      professor_results_link: editUrl,
      question_count: questions.length,
    })
    return Response.json({
      formUrl,
      editUrl,
      student_quiz_link: formUrl,
      professor_results_link: editUrl,
      warning: saveError ? 'The form was created, but its links could not be saved to your quiz list.' : null,
    })
  } catch (error) {
    console.error('Google Forms publishing failed:', error)
    return jsonError('Unexpected Google Forms publishing error. Please try again.', 500)
  }
}
