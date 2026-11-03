import { z } from 'zod'
import { jsonError, requireProfessorOrAdmin } from '@/lib/api-auth'
import { searchStockImage } from '@/lib/stock-images'

export const runtime = 'nodejs'

const querySchema = z.object({ q: z.string().trim().min(2).max(120) })

// Finds an openly licensed picture for an [IMAGE: query] placement hook.
export async function GET(request: Request) {
  const auth = await requireProfessorOrAdmin('look up slide images')
  if ('response' in auth) return auth.response
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return jsonError('A search query of 2-120 characters is required.', 400)
  const image = await searchStockImage(parsed.data.q)
  return Response.json({ image }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
