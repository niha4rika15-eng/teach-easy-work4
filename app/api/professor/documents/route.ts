import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { ingestProfessorDocument } from '@/ingestion'
import { MAX_DOCUMENT_CHARACTERS } from '@/chunking'
import { extractDocumentText } from '@/lib/document-extraction'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_FILE_BYTES = 4 * 1024 * 1024
const documentTitleSchema = z.string().trim().min(1).max(200)

async function getProfessor() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { response: Response.json({ error: 'Sign in to manage your source documents.' }, { status: 401 }) }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (profileError) throw new Error(`Could not verify the current user role: ${profileError.message}`)
  if (profile?.role !== 'professor' && profile?.role !== 'admin') {
    return { response: Response.json({ error: 'Only professors and administrators can manage source documents.' }, { status: 403 }) }
  }
  return { supabase, user: authData.user }
}

export async function GET() {
  try {
    const auth = await getProfessor()
    if ('response' in auth) return auth.response

    const { data, error } = await auth.supabase
      .from('professor_documents')
      .select('id, title, mime_type, byte_size, character_count, chunk_count, status, error_message, created_at')
      .eq('professor_id', auth.user.id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Could not load source documents: ${error.message}`)
    return Response.json({ documents: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected document listing error.'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getProfessor()
    if ('response' in auth) return auth.response

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return Response.json({ error: 'Upload a valid multipart form containing one source file.' }, { status: 400 })
    }
    const upload = form.get('file')
    if (!(upload instanceof File)) {
      return Response.json({ error: 'Choose a PDF, DOCX, TXT, or Markdown file to upload.' }, { status: 400 })
    }
    if (!upload.size || upload.size > MAX_FILE_BYTES) {
      return Response.json({ error: 'Files must be between 1 byte and 4 MB.' }, { status: 413 })
    }

    const extension = upload.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'docx', 'txt', 'md'].includes(extension)) {
      return Response.json({ error: 'Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.' }, { status: 415 })
    }
    const titleValue = form.get('title')
    const titleResult = documentTitleSchema.safeParse(
      typeof titleValue === 'string' && titleValue.trim() ? titleValue : upload.name.replace(/\.[^.]+$/, ''),
    )
    if (!titleResult.success) {
      return Response.json({ error: titleResult.error.issues[0]?.message ?? 'Document title is invalid.' }, { status: 400 })
    }

    const bytes = Buffer.from(await upload.arrayBuffer())
    let content: string
    try {
      content = (await extractDocumentText(upload.name, bytes)).replace(/\u0000/g, '').trim()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not extract text from the uploaded file.'
      return Response.json({ error: message }, { status: 422 })
    }
    if (!content) {
      return Response.json({ error: 'No selectable text was found. Scanned PDFs need OCR before they can be indexed.' }, { status: 422 })
    }
    if (content.length > MAX_DOCUMENT_CHARACTERS) {
      return Response.json({ error: `Extracted text exceeds the ${MAX_DOCUMENT_CHARACTERS.toLocaleString()} character limit.` }, { status: 413 })
    }

    const { data: document, error: insertError } = await auth.supabase
      .from('professor_documents')
      .insert({
        professor_id: auth.user.id,
        title: titleResult.data,
        mime_type: extension === 'pdf' ? 'application/pdf'
          : extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : extension === 'md' ? 'text/markdown' : 'text/plain',
        byte_size: upload.size,
        character_count: content.length,
        content_hash: createHash('sha256').update(bytes).digest('hex'),
        status: 'processing',
      })
      .select('id')
      .single()
    if (insertError || !document) throw new Error(`Could not create the document record: ${insertError?.message ?? 'No row returned.'}`)

    try {
      const result = await ingestProfessorDocument({
        documentId: document.id,
        title: titleResult.data,
        content,
      })
      return Response.json({ id: document.id, status: 'ready', chunks: result.count }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document indexing failed.'
      const { error: cleanupError } = await auth.supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', document.id)
        .eq('professor_id', auth.user.id)
      const { error: updateError } = await auth.supabase
        .from('professor_documents')
        .update({ status: 'failed', error_message: message.slice(0, 1000), updated_at: new Date().toISOString() })
        .eq('id', document.id)
        .eq('professor_id', auth.user.id)
      const cleanupMessage = cleanupError ? ` Partial indexed passages could not be removed: ${cleanupError.message}` : ''
      const statusMessage = updateError ? ` Failed status could not be saved: ${updateError.message}` : ''
      return Response.json({ error: `${message}${cleanupMessage}${statusMessage}`, document_id: document.id }, { status: 502 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected document upload error.'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getProfessor()
    if ('response' in auth) return auth.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
    }
    const parsed = z.object({ id: z.string().uuid() }).safeParse(body)
    if (!parsed.success) return Response.json({ error: 'A valid document ID is required.' }, { status: 400 })

    const { data, error } = await auth.supabase
      .from('professor_documents')
      .delete()
      .eq('id', parsed.data.id)
      .eq('professor_id', auth.user.id)
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Could not delete the source document: ${error.message}`)
    if (!data) return Response.json({ error: 'Document not found or you do not own it.' }, { status: 404 })
    return Response.json({ deleted: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected document deletion error.'
    return Response.json({ error: message }, { status: 500 })
  }
}
