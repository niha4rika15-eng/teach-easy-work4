// Live export smoke test: real Wikimedia images + Unicode PDF. Run: npx tsx --tsconfig tsconfig.json tests/live/export-smoke.ts
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createDocx, createPdf, createPptx, stockCaption, toExportImage, type ExportImage } from '../../lib/exporters'
import { extractImageQueries } from '../../lib/content-segments'
import { downloadStockImage, searchStockImage } from '../../lib/stock-images'

const sample = existsSync('/tmp/gen-ppt_outline-English.md') ? readFileSync('/tmp/gen-ppt_outline-English.md', 'utf8')
  : '## Slide 1: Photosynthesis\n**Key points:**\n- Light reactions\n**Visual:** Leaf\n[IMAGE: chloroplast]\n**Speaker notes:** Intro.\n'
const indic = '# प्रकाश संश्लेषण\n- क्लोरोफिल (Chlorophyll) प्रकाश ऊर्जा को अवशोषित करता है।\n## বাংলা: সালোকসংশ্লেষণ উদ্ভিদের খাদ্য তৈরি করে।\n## తెలుగు: కిరణజన్య సంయోగక్రియ\n| Concept | अर्थ |\n|---|---|\n| ATP | ऊर्जा मुद्रा |\n[IMAGE: chloroplast]'
;(async () => {
  const images = new Map<string, ExportImage>()
  for (const query of extractImageQueries(sample + indic).slice(0, 6)) {
    const found = await searchStockImage(query)
    const bytes = found ? await downloadStockImage(found) : null
    const image = bytes && found ? toExportImage(bytes, stockCaption(found)) : null
    console.log('image', query, image ? `${image.width}x${image.height} ${image.type}` : 'none')
    if (image) images.set(query, image)
  }
  const assets = { diagrams: [], images }
  writeFileSync('/tmp/deck.pptx', await createPptx('Deck', sample, assets))
  writeFileSync('/tmp/indic.pdf', await createPdf('बहुभाषी नोट्स', indic, assets))
  writeFileSync('/tmp/indic.docx', await createDocx('Notes', indic, assets))
  console.log('ok pptx/pdf/docx written')
})().catch((error) => { console.error('FAIL', error); process.exit(1) })
