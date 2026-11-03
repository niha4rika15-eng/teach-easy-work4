export const MAX_DOCUMENT_CHARACTERS = 200_000
export const MAX_CHUNK_CHARACTERS = 3_200
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
  if (!Number.isInteger(maxCharacters) || maxCharacters <= CHUNK_OVERLAP_CHARACTERS) {
    throw new Error('Chunk size must be an integer greater than the overlap.')
  }

  const chunks: DocumentChunk[] = []
  let start = 0
  while (start < text.length) {
    const hardEnd = Math.min(start + maxCharacters, text.length)
    let end = hardEnd
    if (hardEnd < text.length) {
      const paragraphBoundary = text.lastIndexOf('\n\n', hardEnd)
      const sentenceBoundary = Math.max(
        text.lastIndexOf('. ', hardEnd),
        text.lastIndexOf('! ', hardEnd),
        text.lastIndexOf('? ', hardEnd),
      )
      const preferredBoundary = paragraphBoundary >= start + maxCharacters * 0.55
        ? paragraphBoundary
        : sentenceBoundary + 1 >= start + maxCharacters * 0.55
          ? sentenceBoundary + 1
          : hardEnd
      end = preferredBoundary
    }

    const content = text.slice(start, end)
    if (content.trim()) chunks.push({ index: chunks.length, content, sourceMetadata: { start, end } })
    if (end === text.length) break
    const nextStart = Math.max(0, end - CHUNK_OVERLAP_CHARACTERS)
    const overlapBoundary = text.indexOf('\n', nextStart)
    start = overlapBoundary >= 0 && overlapBoundary < end ? overlapBoundary + 1 : nextStart
  }
  return chunks
}
