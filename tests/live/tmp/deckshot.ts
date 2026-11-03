import { readFileSync, writeFileSync } from 'node:fs'
import 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'
import { createCanvas, loadImage } from '@napi-rs/canvas'
;(async () => {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(process.argv[2])) })
  const shot = await parser.getScreenshot({ scale: 0.5 })
  const pages = shot.pages
  const first = await loadImage(Buffer.from(pages[0].data))
  const cols = 3, w = first.width, h = first.height, rows = Math.ceil(pages.length / cols)
  const canvas = createCanvas(cols * w, rows * h)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#888'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pages.length; i++) ctx.drawImage(await loadImage(Buffer.from(pages[i].data)), (i % cols) * w + 2, Math.floor(i / cols) * h + 2, w - 4, h - 4)
  writeFileSync(process.argv[3], canvas.toBuffer('image/png'))
  console.log('pages', pages.length, w, h)
  await parser.destroy()
})()
