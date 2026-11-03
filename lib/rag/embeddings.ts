import { getAiProvider } from '@/lib/ai'

export const EMBEDDING_DIMENSIONS = 1536
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
const BATCH_SIZE = { openai: 64, gemini: 100 } as const
// Cosine cutoffs below which a passage is treated as unrelated; Gemini vectors have a higher baseline similarity.
const MIN_RELEVANT_SIMILARITY = { openai: 0.2, gemini: 0.6 } as const

export function getMinimumRelevantSimilarity() {
  return MIN_RELEVANT_SIMILARITY[getAiProvider()]
}

type EmbeddingOptions = {
  maxAttempts?: number
  timeoutMs?: number
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
}

type OpenAiEmbeddingResponse = { data?: Array<{ index?: number; embedding?: number[] }> }
type GeminiEmbeddingResponse = { embeddings?: Array<{ values?: number[] }> }

export function validateVector(vector: number[] | undefined): number[] {
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding provider returned a vector with an invalid dimension or value (expected ${EMBEDDING_DIMENSIONS}).`)
  }
  return vector
}

// gemini-embedding-001 vectors are only unit-length at 3072 dimensions, so truncated vectors are re-normalized.
export function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return norm ? vector.map((value) => value / norm) : vector
}

async function callProvider(inputs: string[], options: EmbeddingOptions): Promise<number[][]> {
  if (getAiProvider() === 'gemini') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: inputs.map((text) => ({
          model: `models/${GEMINI_EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType: options.taskType ?? 'RETRIEVAL_DOCUMENT',
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    })
    if (!response.ok) throw Object.assign(new Error(await response.text()), { status: response.status })
    const payload = await response.json() as GeminiEmbeddingResponse
    if (!payload.embeddings || payload.embeddings.length !== inputs.length) throw new Error('Embedding provider returned an incomplete batch.')
    return payload.embeddings.map((item) => normalizeVector(validateVector(item.values)))
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? process.env.openai_apikey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: inputs, dimensions: EMBEDDING_DIMENSIONS }),
    cache: 'no-store',
    signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
  })
  if (!response.ok) throw Object.assign(new Error(await response.text()), { status: response.status })
  const payload = await response.json() as OpenAiEmbeddingResponse
  if (!payload.data || payload.data.length !== inputs.length) throw new Error('Embedding provider returned an incomplete batch.')
  const ordered: Array<number[] | undefined> = Array(inputs.length)
  for (const item of payload.data) {
    const index = item.index
    if (!Number.isInteger(index) || index! < 0 || index! >= inputs.length || ordered[index!]) {
      throw new Error('Embedding provider returned invalid batch indexes.')
    }
    ordered[index!] = validateVector(item.embedding)
  }
  if (ordered.some((vector) => !vector)) throw new Error('Embedding provider omitted an input from its batch.')
  return ordered as number[][]
}

async function requestEmbeddings(inputs: string[], options: EmbeddingOptions): Promise<number[][]> {
  const maxAttempts = options.maxAttempts ?? 3
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await callProvider(inputs, options)
    } catch (error) {
      const status = (error as { status?: number }).status
      const retryable = status === 429 || (status !== undefined && status >= 500)
      if (status === undefined) throw error
      if (!retryable || attempt >= maxAttempts - 1) {
        throw new Error(`Embedding provider failed (${status}): ${(error as Error).message.slice(0, 500)}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
}

export async function createEmbeddings(inputs: string[], options: EmbeddingOptions = {}): Promise<number[][]> {
  if (!inputs.length) return []
  const batchSize = BATCH_SIZE[getAiProvider()]
  const vectors: number[][] = []
  for (let offset = 0; offset < inputs.length; offset += batchSize) {
    vectors.push(...await requestEmbeddings(inputs.slice(offset, offset + batchSize), options))
  }
  return vectors
}

export async function createEmbedding(input: string, options: EmbeddingOptions = {}): Promise<number[]> {
  const [embedding] = await createEmbeddings([input], { taskType: 'RETRIEVAL_QUERY', ...options })
  if (!embedding) throw new Error('Embedding provider returned no vector.')
  return embedding
}
