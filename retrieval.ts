import { createClient } from '@/lib/supabase/server'

export const MAX_RETRIEVED_CHUNKS = 50

export type RetrievedChunk = {
  id: string
  document_id: string
  title: string
  content: string
  source_metadata: Record<string, unknown>
  similarity: number
}

export async function retrieveDocumentChunks(queryEmbedding: number[], courseId?: string, limit = MAX_RETRIEVED_CHUNKS) {
  if (queryEmbedding.length !== 1536) throw new Error('Embedding dimension does not match the database contract.')
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RETRIEVED_CHUNKS) {
    throw new Error(`Retrieval limit must be between 1 and ${MAX_RETRIEVED_CHUNKS}.`)
  }
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Authentication is required for retrieval.')
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: limit,
    requested_course_id: courseId ?? null,
  })
  if (error) throw new Error(`Retrieval failed: ${error.message}`)
  return (data ?? []) as RetrievedChunk[]
}

export async function retrieveAllProfessorDocumentChunks(): Promise<RetrievedChunk[]> {
  const supabase = await createClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData.user) throw new Error('Authentication is required to retrieve uploaded documents.')

  const pageSize = 1000
  const chunks: RetrievedChunk[] = []
  let retrievedCharacters = 0
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, chunk_index, content, source_metadata')
      .eq('professor_id', userData.user.id)
      .order('document_id', { ascending: true })
      .order('chunk_index', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Uploaded-document retrieval failed: ${error.message}`)

    for (const row of data ?? []) {
      retrievedCharacters += row.content.length
      if (retrievedCharacters > 200_000) {
        throw new Error('Uploaded document context exceeds the 200,000 character limit. No source was truncated.')
      }
      const metadata = row.source_metadata && typeof row.source_metadata === 'object'
        ? row.source_metadata as Record<string, unknown>
        : {}
      chunks.push({
        id: row.id,
        document_id: row.document_id,
        title: typeof metadata.title === 'string' ? metadata.title : 'Untitled source document',
        content: row.content,
        source_metadata: metadata,
        similarity: 1,
      })
    }
    if ((data?.length ?? 0) < pageSize) return chunks
  }
}
