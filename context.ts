import type { RetrievedChunk } from './retrieval'

export const MAX_SYNTHESIS_CONTEXT_CHARACTERS = 200_000

export function combineSynthesisContext(sourceMaterial: string, chunks: RetrievedChunk[]) {
  const uploadedSources = chunks.map((chunk) => (
    `Source document: ${chunk.title} (chunk ${chunk.source_metadata.start ?? chunk.id})\n${chunk.content}`
  ))
  const sections = [sourceMaterial, ...uploadedSources].filter((section) => section.length > 0)
  const context = sections.join('\n\n---\n\n')
  if (context.length > MAX_SYNTHESIS_CONTEXT_CHARACTERS) {
    throw new Error(`Combined source context exceeds the ${MAX_SYNTHESIS_CONTEXT_CHARACTERS} character limit. No source was truncated.`)
  }
  return context
}
