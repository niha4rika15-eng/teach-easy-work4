import type { RetrievedChunk } from './retrieval'

export const MAX_SYNTHESIS_CONTEXT_CHARACTERS = 240_000

export function combineSynthesisContext(sourceMaterial: string, chunks: RetrievedChunk[]) {
  const uploadedSources = chunks.map((chunk) => (
    `[${chunk.document_id}:${chunk.chunk_index}] ${chunk.title}\n${chunk.content}`
  ))
  const sections = [sourceMaterial, ...uploadedSources].filter((section) => section.length > 0)
  const context = sections.join('\n\n---\n\n')
  if (context.length > MAX_SYNTHESIS_CONTEXT_CHARACTERS) {
    throw new Error(`Combined source context exceeds ${MAX_SYNTHESIS_CONTEXT_CHARACTERS} characters. Narrow the source text or use fewer retrieved documents.`)
  }
  return context
}
