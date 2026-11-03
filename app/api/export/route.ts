import { z } from 'zod'
import { jsonError, requireProfessorOrAdmin } from '@/lib/api-auth'
import { extractImageQueries } from '@/lib/content-segments'
import { createDocx, createPdf, createPptx, stockCaption, toExportImage, type ExportAssets, type ExportImage } from '@/lib/exporters'
import { downloadStockImage, searchStockImage } from '@/lib/stock-images'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_DIAGRAM_BYTES = 2 * 1024 * 1024
const MAX_IMAGES = 15

const requestSchema = z.object({
  generation_id: z.string().uuid(),
  format: z.enum(['pdf', 'docx', 'pptx']),
  // PNG data URLs of the Mermaid diagrams rendered in the browser, in document order.
  diagrams: z.array(z.string().max(3_000_000).nullable()).max(30).default([]),
  include_images: z.boolean().default(true),
})

const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const

function decodeDiagram(dataUrl: string | null): ExportImage | null {
  const match = dataUrl?.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null
  const bytes = Buffer.from(match[1], 'base64')
  return bytes.length <= MAX_DIAGRAM_BYTES ? toExportImage(bytes) : null
}

async function loadStockImages(content: string) {
  const images = new Map<string, ExportImage>()
  const queries = extractImageQueries(content).slice(0, MAX_IMAGES)
  await Promise.all(queries.map(async (query) => {
    const found = await searchStockImage(query)
    if (!found) return
    const bytes = await downloadStockImage(found)
    const image = bytes ? toExportImage(bytes, stockCaption(found)) : null
    if (image) images.set(query, image)
  }))
  return images
}

type StaffSession = Exclude<Awaited<ReturnType<typeof requireProfessorOrAdmin>>, { response: Response }>

async function handleExport(auth: StaffSession, input: z.infer<typeof requestSchema>) {
  try {
    const { data: generation, error: generationError } = await auth.supabase
      .from('generations')
      .select('id, template_type, target_language, generated_text')
      .eq('id', input.generation_id)
      .eq('user_id', auth.user.id)
      .maybeSingle()
    if (generationError) throw new Error(`Could not load generated content: ${generationError.message}`)
    if (!generation?.generated_text) return jsonError('Generated content was not found or is not owned by you.', 404)
    if (generation.generated_text.length > 200_000) return jsonError('Generated content is too large to export.', 413)

    const assets: ExportAssets = {
      diagrams: input.diagrams.map(decodeDiagram),
      images: input.include_images ? await loadStockImages(generation.generated_text) : new Map(),
    }
    const title = `${generation.template_type.replace(/_/g, ' ')} (${generation.target_language})`
    const output = input.format === 'docx'
      ? await createDocx(title, generation.generated_text, assets)
      : input.format === 'pdf'
        ? await createPdf(title, generation.generated_text, assets)
        : await createPptx(title, generation.generated_text, assets)

    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': MIME_TYPES[input.format],
        'Content-Disposition': `attachment; filename="teach-easy-${generation.id}.${input.format}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Export failed:', error)
    return jsonError(error instanceof Error ? error.message : 'Unexpected export error.', 500)
  }
}

export async function GET(request: Request) {
  const auth = await requireProfessorOrAdmin('export generated content')
  if ('response' in auth) return auth.response
  const parsed = requestSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return jsonError('A valid generation_id and export format are required.', 400)
  return handleExport(auth, parsed.data)
}

export async function POST(request: Request) {
  const auth = await requireProfessorOrAdmin('export generated content')
  if ('response' in auth) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Request body must be valid JSON.', 400)
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'A valid generation_id and export format are required.', 400)
  return handleExport(auth, parsed.data)
}
