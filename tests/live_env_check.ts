// Live check: provider resolution + embeddings using only custom env name geminiapi_script
import { getAiProvider } from '../lib/ai'
import { createEmbedding } from '../lib/rag/embeddings'
import { getGoogleAppsScriptUrl } from '../lib/env'

async function main() {
  const provider = getAiProvider()
  console.log('provider', provider)
  console.log('appsScriptConfigured', Boolean(getGoogleAppsScriptUrl()))
  const v = await createEmbedding('TEST photosynthesis in plants')
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  console.log('dims', v.length, 'norm', norm.toFixed(4))
}
main().catch((e) => { console.error('FAIL', String(e?.message ?? e).slice(0, 200)); process.exit(1) })
