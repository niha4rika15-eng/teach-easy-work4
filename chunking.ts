export const MAX_DOCUMENT_CHARACTERS = 200_000
export const MAX_CHUNK_CHARACTERS = 4_000
export const CHUNK_OVERLAP_CHARACTERS = 400

export type DocumentChunk = {
  index: number
  content: string
  sourceMetadata: { start: number; end: number }
}

export function chunkDocument(input: string, maxCharacters = MAX_CHUNK_CHARACTERS): DocumentChunk[] {
  const text = input
  if (!text.trim()) return []
  if (text.length > MAX_DOCUMENT_CHARACTERS) throw new Error('Document exceeds the configured size limit.')
  if (maxCharacters <= CHUNK_OVERLAP_CHARACTERS) throw new Error('Chunk size must exceed overlap.')

  const chunks: DocumentChunk[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + maxCharacters, text.length)
    const content = text.slice(start, end)
    if (content.trim()) chunks.push({ index: chunks.length, content, sourceMetadata: { start, end } })
    if (end === text.length) break
    start = end - CHUNK_OVERLAP_CHARACTERS
  }
  return chunks
}
