const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const MAX_EMBEDDING_BATCH_SIZE = 64

type EmbeddingResponse = {
  data?: Array<{ index?: number; embedding?: number[] }>
  error?: { message?: string }
}

type EmbeddingOptions = {
  maxAttempts?: number
  timeoutMs?: number
}

async function requestEmbeddings(inputs: string[], options: EmbeddingOptions = {}): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.openai_apikey
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.')

  const maxAttempts = options.maxAttempts ?? 3
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: inputs, dimensions: EMBEDDING_DIMENSIONS }),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    })

    if (response.ok) {
      const payload = await response.json() as EmbeddingResponse
      const vectors = payload.data
      if (!vectors || vectors.length !== inputs.length) {
        throw new Error('Embedding provider returned an incomplete batch.')
      }

      const ordered: Array<number[] | undefined> = Array(inputs.length)
      for (const item of vectors) {
        if (!Number.isInteger(item.index) || item.index! < 0 || item.index! >= inputs.length || ordered[item.index!]) {
          throw new Error('Embedding provider returned invalid batch indexes.')
        }
        const vector = item.embedding
        if (
          !vector ||
          vector.length !== EMBEDDING_DIMENSIONS ||
          vector.some((value) => !Number.isFinite(value))
        ) {
          throw new Error('Embedding provider returned a vector with an invalid dimension or value.')
        }
        ordered[item.index!] = vector
      }
      if (ordered.some((vector) => !vector)) throw new Error('Embedding provider omitted an input from its batch.')
      return ordered as number[][]
    }

    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === maxAttempts - 1) {
      const detail = await response.text()
      throw new Error(`Embedding provider failed (${response.status}): ${detail.slice(0, 500)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }

  throw new Error('Embedding provider retries were exhausted.')
}

export async function createEmbeddings(inputs: string[], options: EmbeddingOptions = {}): Promise<number[][]> {
  if (!inputs.length) return []
  const vectors: number[][] = []
  for (let offset = 0; offset < inputs.length; offset += MAX_EMBEDDING_BATCH_SIZE) {
    vectors.push(...await requestEmbeddings(inputs.slice(offset, offset + MAX_EMBEDDING_BATCH_SIZE), options))
  }
  return vectors
}

export async function createEmbedding(input: string, options: EmbeddingOptions = {}): Promise<number[]> {
  const [embedding] = await createEmbeddings([input], options)
  if (!embedding) throw new Error('Embedding provider returned no vector.')
  return embedding
}
