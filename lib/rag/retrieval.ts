import { createClient } from '@/lib/supabase/server'
import { EMBEDDING_DIMENSIONS } from './embeddings'

export const MAX_RETRIEVED_CHUNKS = 20
export const DEFAULT_RETRIEVAL_COUNT = 8

export type RetrievedChunk = {
  id: string
  document_id: string
  title: string
  chunk_index: number
  content: string
  source_metadata: Record<string, unknown>
  similarity: number
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] ** 2
    rightNorm += right[index] ** 2
  }
  if (!leftNorm || !rightNorm) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

export type EvidenceChunk = Pick<RetrievedChunk, 'id' | 'document_id' | 'title' | 'chunk_index' | 'content' | 'similarity'>

export function selectRelevantChunks<T extends EvidenceChunk>(chunks: T[], limit = 8, minimumSimilarity = 0.2) {
  const selected: T[] = []
  for (const chunk of [...chunks].sort((a, b) => b.similarity - a.similarity)) {
    if (chunk.similarity < minimumSimilarity) continue
    const nearDuplicate = selected.some(
      (item) => item.document_id === chunk.document_id && Math.abs(item.chunk_index - chunk.chunk_index) < 2,
    )
    if (!nearDuplicate) selected.push(chunk)
    if (selected.length >= limit) break
  }
  return selected
}

export async function retrieveDocumentChunks(queryEmbedding: number[], limit = DEFAULT_RETRIEVAL_COUNT) {
  if (queryEmbedding.length !== EMBEDDING_DIMENSIONS) throw new Error('Embedding dimension does not match the database contract.')
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RETRIEVED_CHUNKS) {
    throw new Error(`Retrieval limit must be between 1 and ${MAX_RETRIEVED_CHUNKS}.`)
  }
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Authentication is required for retrieval.')
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: limit,
  })
  if (error) throw new Error(`Retrieval failed: ${error.message}`)
  const chunks = ((data ?? []) as RetrievedChunk[]).filter((chunk) => Number.isFinite(chunk.similarity))
  if (!chunks.length) return []

  // Defense in depth: keep only passages from this professor's own ready documents.
  const { data: ownedDocuments, error: ownershipError } = await supabase
    .from('professor_documents')
    .select('id')
    .eq('professor_id', userData.user.id)
    .eq('status', 'ready')
    .in('id', Array.from(new Set(chunks.map((chunk) => chunk.document_id))))
  if (ownershipError) throw new Error(`Retrieval ownership check failed: ${ownershipError.message}`)
  const allowed = new Set((ownedDocuments ?? []).map((document) => document.id as string))
  return chunks.filter((chunk) => allowed.has(chunk.document_id))
}
