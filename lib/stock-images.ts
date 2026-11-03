export type StockImage = {
  url: string
  width: number
  height: number
  mime: 'image/jpeg' | 'image/png'
  title: string
  author: string
  license: string
  sourceUrl: string
}

type CommonsResponse = {
  query?: {
    pages?: Record<string, {
      title?: string
      index?: number
      imageinfo?: Array<{
        thumburl?: string
        thumbwidth?: number
        thumbheight?: number
        mime?: string
        descriptionurl?: string
        extmetadata?: Record<string, { value?: string }>
      }>
    }>
  }
}

const USER_AGENT = 'TeachEasy/1.0 (educational content generator)'
const stripHtml = (value = '') => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

const STOP_WORDS = new Set(['and', 'of', 'the', 'a', 'an', 'with', 'for', 'in', 'on', 'to', 'diagram', 'labeled', 'illustration', 'icon', 'icons', 'structure'])

// Long, specific hooks rarely match; retry with progressively shorter keyword sets.
export function imageQueryVariants(query: string) {
  const words = query.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((word) => word && !STOP_WORDS.has(word))
  return Array.from(new Set([query.trim(), words.slice(0, 4).join(' '), words.slice(0, 2).join(' '), words[0] ?? ''].filter((value) => value.length >= 2)))
}

// Openly licensed photos and illustrations from Wikimedia Commons (no API key required).
export async function searchStockImage(query: string): Promise<StockImage | null> {
  for (const variant of imageQueryVariants(query)) {
    const found = await searchCommons(variant)
    if (found) return found
  }
  return null
}

async function searchCommons(query: string): Promise<StockImage | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query.slice(0, 120)} filetype:bitmap`,
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '1024',
    origin: '*',
  })
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
    })
    if (!response.ok) return null
    const payload = await response.json() as CommonsResponse
    const pages = Object.values(payload.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    for (const page of pages) {
      const info = page.imageinfo?.[0]
      if (!info?.thumburl || !info.thumbwidth || !info.thumbheight) continue
      if (info.mime !== 'image/jpeg' && info.mime !== 'image/png') continue
      const metadata = info.extmetadata ?? {}
      return {
        url: info.thumburl,
        width: info.thumbwidth,
        height: info.thumbheight,
        mime: info.mime,
        title: (page.title ?? query).replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        author: stripHtml(metadata.Artist?.value) || 'Wikimedia Commons contributor',
        license: stripHtml(metadata.LicenseShortName?.value) || 'See source',
        sourceUrl: info.descriptionurl ?? 'https://commons.wikimedia.org',
      }
    }
    return null
  } catch {
    return null
  }
}

export async function downloadStockImage(image: StockImage): Promise<Buffer | null> {
  try {
    const response = await fetch(image.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.length > 0 && bytes.length <= 4 * 1024 * 1024 ? bytes : null
  } catch {
    return null
  }
}
