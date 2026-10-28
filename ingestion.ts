import { createClient } from '@/lib/supabase/server'
import { chunkDocument } from './chunking'
import { createEmbedding } from './embeddings'

export async function ingestProfessorDocument(input: {
  documentId: string
  title: string
  content: string
  courseId?: string | null
}) {
  const chunks = chunkDocument(input.content)
  if (!chunks.length) throw new Error('Document content is empty.')
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Authentication is required for ingestion.')

  const rows = []
  for (const chunk of chunks) {
    const embedding = await createEmbedding(chunk.content)
    rows.push({ document_id: input.documentId, professor_id: userData.user.id, course_id: input.courseId ?? null, chunk_index: chunk.index, content: chunk.content, embedding: JSON.stringify(embedding), source_metadata: { ...chunk.sourceMetadata, title: input.title } })
  }
  const { error } = await supabase.from('document_chunks').upsert(rows, { onConflict: 'document_id,chunk_index' })
  if (error) throw new Error(`Document ingestion failed: ${error.message}`)
  return { count: rows.length }
}
