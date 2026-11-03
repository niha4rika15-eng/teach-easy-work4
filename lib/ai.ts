import { getGeminiApiKey, getOpenAiApiKey } from '@/lib/env'

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

export type AiProvider = 'gemini' | 'openai'

// Used only when the primary Gemini model is overloaded (503/429) after retries.
const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3-flash-preview']

// Gemini is preferred when configured; OpenAI remains supported.
export function getAiProvider(): AiProvider {
  if (getGeminiApiKey()) return 'gemini'
  if (getOpenAiApiKey()) return 'openai'
  throw new Error('No AI provider is configured. Set geminiapi_script (or openai_api_key) on the server.')
}

function getChatConfig() {
  if (getAiProvider() === 'gemini') {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: getGeminiApiKey() as string,
      models: [process.env.GEMINI_MODEL ?? 'gemini-3.8-flash', ...GEMINI_FALLBACK_MODELS],
      tokenField: 'max_tokens',
      extra: { reasoning_effort: 'low' },
      label: 'Gemini',
    }
  }
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey: getOpenAiApiKey() as string,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    tokenField: 'max_completion_tokens',
    label: 'OpenAI',
  }
}

function extractProviderMessage(detail: string) {
  try {
    const parsed = JSON.parse(detail) as ChatResponse | Array<ChatResponse>
    const first = Array.isArray(parsed) ? parsed[0] : parsed
    return first?.error?.message ?? detail
  } catch {
    return detail
  }
}

export async function createChatCompletion(messages: ChatMessage[], options: ChatOptions = {}) {
  const config = getChatConfig()
  const models = Array.from(new Set(config.models))
  let lastError: Error | null = null
  for (const model of models) {
    try {
      return await requestChat(config, model, messages, options)
    } catch (error) {
      lastError = error as Error
      if (!(error as { retryable?: boolean }).retryable) throw error
    }
  }
  throw lastError ?? new Error('Language model retries were exhausted.')
}

async function requestChat(config: ReturnType<typeof getChatConfig>, model: string, messages: ChatMessage[], options: ChatOptions) {
  const maxAttempts = options.maxAttempts ?? 3
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response
    try {
      response = await fetch(config.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          [config.tokenField]: options.maxTokens ?? 4000,
          ...config.extra,
          ...(options.jsonObject ? { response_format: { type: 'json_object' } } : {}),
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
      })
    } catch (error) {
      // Timeouts and network failures are retried, then fall through to the next model.
      if (attempt === maxAttempts - 1) {
        throw Object.assign(new Error(`${config.label} request failed: ${(error as Error).message}`), { retryable: true })
      }
      continue
    }

    if (response.ok) {
      const payload = await response.json() as ChatResponse
      let content = payload.choices?.[0]?.message?.content?.trim()
      if (!content) throw new Error('The language model returned an empty answer.')
      if (options.jsonObject) content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      return content
    }

    const detail = await response.text()
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === maxAttempts - 1) {
      throw Object.assign(
        new Error(`${config.label} request failed (${response.status}): ${extractProviderMessage(detail).slice(0, 500)}`),
        { retryable },
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt))
  }
  throw new Error('Language model retries were exhausted.')
}
