// Iteration 4 check: images + diagram PNGs embed into PDF/DOCX/PPTX. Run: npx tsx --tsconfig tsconfig.json tests/live/tmp/assets-smoke.ts
import { writeFileSync } from 'node:fs'
import { createDocx, createPdf, createPptx, stockCaption, toExportImage, type ExportImage } from '../../../lib/exporters'
import { downloadStockImage, searchStockImage } from '../../../lib/stock-images'

const content = '# प्रकाश संश्लेषण\n- क्लोरोफिल ऊर्जा\n[IMAGE: chloroplast]\n```mermaid\nflowchart TD\nA[प्रकाश] --> B[ATP]\n```\nবাংলা লেখা\n'
const deck = '## Slide 1: Intro\n- point\n[IMAGE: chloroplast]\n**Speaker notes:** x\n## Slide 2: Flow\n- p\n```mermaid\nflowchart TD\nA-->B\n```\n'
;(async () => {
  const found = await searchStockImage('chloroplast')
  const bytes = found ? await downloadStockImage(found) : null
  const image = bytes && found ? toExportImage(bytes, stockCaption(found)) : null
  console.log('image', image ? `${image.width}x${image.height}` : 'NONE')
  const pngB64 = process.env.DIAGRAM_B64
  const diagram: ExportImage | null = pngB64 ? toExportImage(Buffer.from(pngB64, 'base64')) : image
  const assets = { diagrams: [diagram], images: new Map(image ? [['chloroplast', image]] : []) }
  writeFileSync('/tmp/a.pdf', await createPdf('Test', content, assets))
  writeFileSync('/tmp/a.docx', await createDocx('Test', content, assets))
  writeFileSync('/tmp/a.pptx', await createPptx('Test', deck, assets))
  console.log('written')
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
