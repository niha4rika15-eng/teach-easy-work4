type UnsplashSearchResponse = {
  results?: Array<{
    urls?: { regular?: string }
    links?: { html?: string }
    user?: { name?: string; links?: { html?: string } }
  }>
}

export type UnsplashImage = {
  url: string
  attribution: {
    photographer: string
    photoUrl: string
    photographerUrl: string
  }
}

function isUnsplashPageUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'unsplash.com' || url.hostname.endsWith('.unsplash.com'))
  } catch {
    return false
  }
}

export async function fetchUnsplashImage(query: string): Promise<UnsplashImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '1')
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('utm_source', 'TeachEasy')
  url.searchParams.set('utm_medium', 'referral')

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Unsplash image search failed with status ${response.status}.`)

  const payload = await response.json() as UnsplashSearchResponse
  const result = payload.results?.[0]
  const imageUrl = result?.urls?.regular
  if (!imageUrl) return null

  const parsedUrl = new URL(imageUrl)
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'images.unsplash.com') {
    throw new Error('Unsplash returned an image URL from an unexpected host.')
  }
  const photoUrl = result.links?.html
  const photographerUrl = result.user?.links?.html
  if (!isUnsplashPageUrl(photoUrl) || !isUnsplashPageUrl(photographerUrl)) {
    throw new Error('Unsplash did not return valid attribution links for the selected image.')
  }
  return {
    url: parsedUrl.toString(),
    attribution: {
      photographer: result.user?.name || 'Unsplash photographer',
      photoUrl,
      photographerUrl,
    },
  }
}
