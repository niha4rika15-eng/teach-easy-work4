type ChatMessage = { role: 'system' | 'user'; content: string }

type ChatOptions = {
  jsonObject?: boolean
  maxTokens?: number
  maxAttempts?: number
  timeoutMs?: number
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string }
}

export async function createChatCompletion(messages: ChatMessage[], options: ChatOptions = {}) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.openai_apikey
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.')

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  const maxAttempts = options.maxAttempts ?? 3
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_completion_tokens: options.maxTokens ?? 4000,
        ...(options.jsonObject ? { response_format: { type: 'json_object' } } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
    })

    if (response.ok) {
      const payload = await response.json() as ChatResponse
      const content = payload.choices?.[0]?.message?.content?.trim()
      if (!content) throw new Error('The language model returned an empty answer.')
      return content
    }

    const detail = await response.text()
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === maxAttempts - 1) {
      let providerMessage = detail
      try {
        const parsed = JSON.parse(detail) as ChatResponse
        providerMessage = parsed.error?.message ?? detail
      } catch {
        providerMessage = detail
      }
      throw new Error(`Language model request failed (${response.status}): ${providerMessage.slice(0, 500)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt))
  }

  throw new Error('Language model retries were exhausted.')
}
