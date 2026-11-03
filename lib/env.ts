// Server-only secrets. Deployment uses the custom lowercase names; standard names remain as fallbacks.
function firstSet(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

export function getOpenAiApiKey() {
  return firstSet(process.env.openai_api_key, process.env.OPENAI_API_KEY, process.env.openai_apikey)
}

export function getGeminiApiKey() {
  return firstSet(process.env.geminiapi_script, process.env.GEMINI_API_KEY)
}

export function getGoogleAppsScriptUrl() {
  return firstSet(process.env.google_gorm_api, process.env.GOOGLE_APPS_SCRIPT_URL, process.env.GOOGLE_FORM_API)
}
