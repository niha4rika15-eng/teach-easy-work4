import { createClient } from '@/lib/supabase/server'
import { chunkDocument } from './chunking'
import { createEmbeddings } from './embeddings'

export async function ingestProfessorDocument(input: {
  documentId: string
  title: string
  content: string
}) {
  const chunks = chunkDocument(input.content)
  if (!chunks.length) throw new Error('Document content is empty.')
  const supabase = await createClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData.user) throw new Error('Authentication is required for ingestion.')

  const { data: document, error: documentError } = await supabase
    .from('professor_documents')
    .select('id')
    .eq('id', input.documentId)
    .eq('professor_id', userData.user.id)
    .maybeSingle()
  if (documentError) throw new Error(`Could not verify the document owner: ${documentError.message}`)
  if (!document) throw new Error('The document does not belong to the authenticated professor.')

  const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content))
  const rows = chunks.map((chunk, index) => ({
    document_id: input.documentId,
    professor_id: userData.user.id,
    chunk_index: chunk.index,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[index]),
    source_metadata: { ...chunk.sourceMetadata, title: input.title },
  }))

  const { error: clearError } = await supabase.from('document_chunks').delete().eq('document_id', input.documentId)
  if (clearError) throw new Error(`Could not prepare document chunks: ${clearError.message}`)
  for (let offset = 0; offset < rows.length; offset += 16) {
    const { error } = await supabase.from('document_chunks').insert(rows.slice(offset, offset + 16))
    if (error) throw new Error(`Document ingestion failed: ${error.message}`)
  }

  const { error: updateError } = await supabase
    .from('professor_documents')
    .update({
      status: 'ready',
      character_count: input.content.length,
      chunk_count: rows.length,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.documentId)
    .eq('professor_id', userData.user.id)
  if (updateError) throw new Error(`Document was indexed but its status could not be updated: ${updateError.message}`)
  return { count: rows.length }
}
