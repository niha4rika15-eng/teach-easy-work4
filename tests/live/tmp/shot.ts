import { readFileSync, writeFileSync } from 'node:fs'
import 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'
;(async () => {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync('/tmp/indic.pdf')) })
  const shot = await parser.getScreenshot({ first: 1, scale: 1.3 })
  writeFileSync('/app/tests/live/tmp/indic-page1.png', Buffer.from(shot.pages[0].data))
  const text = await parser.getText()
  console.log(text.text.slice(0, 300))
  await parser.destroy()
})()
