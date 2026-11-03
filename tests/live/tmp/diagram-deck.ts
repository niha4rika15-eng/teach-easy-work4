// Iteration 5: deck with Chromium-rendered Mermaid PNGs as assets.diagrams. Run: npx tsx --tsconfig tsconfig.json tests/live/tmp/diagram-deck.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createPptx, stockCaption, toExportImage, type ExportImage } from '../../../lib/exporters'
import { extractImageQueries } from '../../../lib/content-segments'
import { downloadStockImage, searchStockImage } from '../../../lib/stock-images'

const sample = readFileSync('tests/live/out/gen-ppt_outline-English.md', 'utf8')
;(async () => {
  const diagrams = [0, 1].map((i) => (existsSync(`/tmp/mm/diagram${i}.png`) ? toExportImage(readFileSync(`/tmp/mm/diagram${i}.png`)) : null))
  console.log('diagrams', diagrams.map((d) => (d ? `${d.width}x${d.height} ${d.type}` : 'none')).join(', '))
  const images = new Map<string, ExportImage>()
  for (const query of extractImageQueries(sample)) {
    await new Promise((r) => setTimeout(r, 800))
    const found = await searchStockImage(query)
    const bytes = found ? await downloadStockImage(found) : null
    const image = bytes && found ? toExportImage(bytes, stockCaption(found)) : null
    console.log('image', query, image ? `${image.width}x${image.height}` : 'none')
    if (image) images.set(query, image)
  }
  writeFileSync('tests/live/out/deck-diagrams.pptx', await createPptx('Deck', sample, { diagrams, images }))
  console.log('ok deck-diagrams.pptx')
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
