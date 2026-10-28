const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'

export async function createEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.openai_apikey
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Embedding provider failed with status ${response.status}.`)
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> }
  const embedding = payload.data?.[0]?.embedding
  if (!embedding?.length) throw new Error('Embedding provider returned no vector.')
  return embedding
}
