import { createHash } from 'node:crypto'
import { z } from 'zod'
import { jsonError, requireProfessorOrAdmin } from '@/lib/api-auth'
import { MAX_DOCUMENT_CHARACTERS } from '@/lib/rag/chunking'
import { extractDocumentText, getSupportedExtension, SUPPORTED_DOCUMENT_TYPES } from '@/lib/document-extraction'
import { ingestProfessorDocument } from '@/lib/rag/ingestion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_FILE_BYTES = 4 * 1024 * 1024
const documentTitleSchema = z.string().trim().min(1).max(200)
const ACTION = 'manage your source documents'

function serverError(context: string, error: unknown) {
  console.error(`${context}:`, error)
  return jsonError(`${context}. Please try again.`, 500)
}

export async function GET() {
  const auth = await requireProfessorOrAdmin(ACTION)
  if ('response' in auth) return auth.response
  try {
    const { data, error } = await auth.supabase
      .from('professor_documents')
      .select('id, title, mime_type, byte_size, character_count, chunk_count, status, error_message, created_at')
      .eq('professor_id', auth.user.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Source document listing failed:', error.message)
      return jsonError('Could not load source documents. Confirm the RAG migration is applied.', 503)
    }
    return Response.json({ documents: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return serverError('Could not load source documents', error)
  }
}

export async function POST(request: Request) {
  const auth = await requireProfessorOrAdmin(ACTION)
  if ('response' in auth) return auth.response
  try {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return jsonError('Upload a valid multipart form containing one source file.', 400)
    }
    const upload = form.get('file')
    if (!(upload instanceof File)) return jsonError('Choose a PDF, DOCX, TXT, or Markdown file to upload.', 400)
    if (!upload.size || upload.size > MAX_FILE_BYTES) return jsonError('Files must be between 1 byte and 4 MB.', 413)

    const extension = getSupportedExtension(upload.name)
    if (!extension) return jsonError('Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.', 415)

    const titleValue = form.get('title')
    const titleResult = documentTitleSchema.safeParse(
      typeof titleValue === 'string' && titleValue.trim() ? titleValue : upload.name.replace(/\.[^.]+$/, ''),
    )
    if (!titleResult.success) return jsonError(titleResult.error.issues[0]?.message ?? 'Document title is invalid.', 400)

    const bytes = Buffer.from(await upload.arrayBuffer())
    let content: string
    try {
      content = (await extractDocumentText(upload.name, bytes)).replace(/\u0000/g, '').trim()
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : 'Could not extract text from the uploaded file.', 422)
    }
    if (!content) return jsonError('No selectable text was found. Scanned PDFs need OCR before they can be indexed.', 422)
    if (content.length > MAX_DOCUMENT_CHARACTERS) {
      return jsonError(`Extracted text exceeds the ${MAX_DOCUMENT_CHARACTERS.toLocaleString()} character limit.`, 413)
    }

    const { data: document, error: insertError } = await auth.supabase
      .from('professor_documents')
      .insert({
        professor_id: auth.user.id,
        title: titleResult.data,
        mime_type: SUPPORTED_DOCUMENT_TYPES[extension],
        byte_size: upload.size,
        character_count: content.length,
        content_hash: createHash('sha256').update(bytes).digest('hex'),
        status: 'processing',
      })
      .select('id')
      .single()
    if (insertError || !document) {
      console.error('Document record insert failed:', insertError?.message)
      return jsonError('Could not create the document record. Confirm the RAG migration is applied.', 503)
    }

    try {
      const result = await ingestProfessorDocument({ documentId: document.id, title: titleResult.data, content })
      return Response.json({ id: document.id, status: 'ready', chunks: result.count }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document indexing failed.'
      await auth.supabase.from('document_chunks').delete().eq('document_id', document.id).eq('professor_id', auth.user.id)
      await auth.supabase
        .from('professor_documents')
        .update({ status: 'failed', error_message: message.slice(0, 1000), updated_at: new Date().toISOString() })
        .eq('id', document.id)
        .eq('professor_id', auth.user.id)
      return jsonError(message, 502, { document_id: document.id })
    }
  } catch (error) {
    return serverError('Document upload failed', error)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireProfessorOrAdmin(ACTION)
  if ('response' in auth) return auth.response
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Request body must be valid JSON.', 400)
    }
    const parsed = z.object({ id: z.string().uuid() }).safeParse(body)
    if (!parsed.success) return jsonError('A valid document ID is required.', 400)

    const { data, error } = await auth.supabase
      .from('professor_documents')
      .delete()
      .eq('id', parsed.data.id)
      .eq('professor_id', auth.user.id)
      .select('id')
      .maybeSingle()
    if (error) return serverError('Could not delete the source document', error.message)
    if (!data) return jsonError('Document not found or you do not own it.', 404)
    return Response.json({ deleted: true })
  } catch (error) {
    return serverError('Could not delete the source document', error)
  }
}
