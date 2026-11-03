import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun, AlignmentType } from 'docx'
import PDFDocument from 'pdfkit'
import PptxGenJS from 'pptxgenjs'
import { hasIndicScript, splitGeneratedContent, splitScriptRuns, stripInlineMarkdown, type Script } from './content-segments'
import type { StockImage } from './stock-images'

export type ExportImage = { data: Buffer; width: number; height: number; type: 'png' | 'jpg'; caption?: string }
// diagrams[i] is the rendered PNG for the i-th Mermaid block; images maps an [IMAGE: query] to a downloaded picture.
export type ExportAssets = { diagrams: Array<ExportImage | null>; images: Map<string, ExportImage> }

const EMPTY_ASSETS: ExportAssets = { diagrams: [], images: new Map() }
const INDIC_OFFICE_FONT = 'Nirmala UI'

export function imageSize(data: Buffer): { width: number; height: number; type: 'png' | 'jpg' } | null {
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), type: 'png' }
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) { offset += 1; continue }
      const marker = data[offset + 1]
      const length = data.readUInt16BE(offset + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7), type: 'jpg' }
      }
      offset += 2 + length
    }
  }
  return null
}

export function toExportImage(data: Buffer, caption?: string): ExportImage | null {
  const size = imageSize(data)
  return size && size.width > 0 && size.height > 0 ? { data, ...size, caption } : null
}

export function stockCaption(image: StockImage) {
  return `${image.title} — ${image.author} (${image.license}), Wikimedia Commons`
}

function fit(image: ExportImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) }
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'image'; image: ExportImage | null; label: string }

// Converts generated Markdown into simple printable blocks shared by the DOCX and PDF exporters.
function toBlocks(content: string, assets: ExportAssets): Block[] {
  const blocks: Block[] = []
  let diagramIndex = 0
  for (const segment of splitGeneratedContent(content.replace(/\r\n?/g, '\n'))) {
    if (segment.kind === 'mermaid') {
      const diagram = assets.diagrams[diagramIndex++] ?? null
      blocks.push(diagram ? { kind: 'image', image: diagram, label: 'Diagram' } : { kind: 'code', text: segment.value })
      continue
    }
    if (segment.kind === 'image') {
      blocks.push({ kind: 'image', image: assets.images.get(segment.value) ?? null, label: segment.value })
      continue
    }
    const parts = segment.value.split(/```[a-z]*\n?/)
    parts.forEach((part, index) => {
      if (index % 2 === 1) {
        if (part.trim()) blocks.push({ kind: 'code', text: part.replace(/\n$/, '') })
        return
      }
      for (const raw of part.split('\n')) {
        const line = raw.trim()
        if (!line || /^\|?\s*:?-{3,}/.test(line)) continue
        const heading = line.match(/^(#{1,4})\s+(.*)$/)
        if (heading) blocks.push({ kind: 'heading', level: heading[1].length, text: stripInlineMarkdown(heading[2]) })
        else if (/^[-*•]\s+/.test(line)) blocks.push({ kind: 'bullet', text: stripInlineMarkdown(line.replace(/^[-*•]\s+/, '')) })
        else if (line.startsWith('|')) blocks.push({ kind: 'text', text: line.split('|').map((cell) => stripInlineMarkdown(cell)).filter(Boolean).join('   |   ') })
        else blocks.push({ kind: 'text', text: stripInlineMarkdown(line.replace(/^>\s*/, '')) })
      }
    })
  }
  return blocks
}

function docxRun(text: string, options: { bold?: boolean; size?: number; font?: string } = {}) {
  return new TextRun({ text, bold: options.bold, size: options.size, font: options.font ?? (hasIndicScript(text) ? INDIC_OFFICE_FONT : undefined) })
}

export function createDocx(title: string, content: string, assets: ExportAssets = EMPTY_ASSETS) {
  const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4]
  const children = toBlocks(content, assets).flatMap((block) => {
    if (block.kind === 'heading') return [new Paragraph({ children: [docxRun(block.text, { bold: true })], heading: headingLevels[block.level], spacing: { before: 200, after: 80 } })]
    if (block.kind === 'bullet') return [new Paragraph({ children: [docxRun(block.text)], bullet: { level: 0 } })]
    if (block.kind === 'code') return block.text.split('\n').map((line) => new Paragraph({ children: [docxRun(line || ' ', { font: hasIndicScript(line) ? INDIC_OFFICE_FONT : 'Consolas', size: 18 })] }))
    if (block.kind === 'image') {
      if (!block.image) return [new Paragraph({ children: [docxRun(`[Image: ${block.label}]`, { bold: true })], alignment: AlignmentType.CENTER })]
      const size = fit(block.image, 560, 420)
      return [
        new Paragraph({ children: [new ImageRun({ data: block.image.data, type: block.image.type, transformation: size })], alignment: AlignmentType.CENTER, spacing: { before: 120 } }),
        ...(block.image.caption ? [new Paragraph({ children: [docxRun(block.image.caption, { size: 16 })], alignment: AlignmentType.CENTER, spacing: { after: 160 } })] : []),
      ]
    }
    return [new Paragraph({ children: [docxRun(block.text)], spacing: { after: 120 } })]
  })

  const document = new Document({
    sections: [{ properties: {}, children: [new Paragraph({ children: [docxRun(title, { bold: true, size: 40 })], heading: HeadingLevel.TITLE, spacing: { after: 240 } }), ...children] }],
  })
  return Packer.toBuffer(document)
}

const FONT_FILES: Record<Script, string> = { latin: 'NotoSans', devanagari: 'NotoSansDevanagari', bengali: 'NotoSansBengali', telugu: 'HindGuntur' }
let fontCache: Record<string, Buffer> | null = null

function loadFonts() {
  if (!fontCache) {
    const directory = path.join(process.cwd(), 'lib', 'fonts')
    fontCache = {}
    for (const family of Object.values(FONT_FILES)) {
      for (const weight of ['Regular', 'Bold']) fontCache[`${family}-${weight}`] = readFileSync(path.join(directory, `${family}-${weight}.ttf`))
    }
  }
  return fontCache
}

// Unicode PDF: every run of Hindi, Marathi, Bengali, Telugu, or Latin text uses an embedded Noto font.
export function createPdf(title: string, content: string, assets: ExportAssets = EMPTY_ASSETS) {
  const fonts = loadFonts()
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 } })
    for (const [name, data] of Object.entries(fonts)) pdf.registerFont(name, data)
    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.on('error', reject)
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    const width = 483

    const write = (text: string, options: { bold?: boolean; size: number; color?: string; indent?: number; gap?: number }) => {
      const runs = splitScriptRuns(text || ' ')
      pdf.fontSize(options.size).fillColor(options.color ?? '#111827')
      runs.forEach((run, index) => {
        pdf.font(`${FONT_FILES[run.script]}-${options.bold ? 'Bold' : 'Regular'}`)
        pdf.text(run.text, { continued: index < runs.length - 1, width: width - (options.indent ?? 0), indent: index === 0 ? options.indent ?? 0 : 0, lineGap: 3, paragraphGap: index === runs.length - 1 ? options.gap ?? 6 : 0 })
      })
    }

    write(title, { bold: true, size: 20, color: '#14532d', gap: 14 })
    for (const block of toBlocks(content, assets)) {
      if (block.kind === 'heading') { pdf.moveDown(0.4); write(block.text, { bold: true, size: block.level <= 1 ? 16 : block.level === 2 ? 14 : 12, color: '#14532d' }) }
      else if (block.kind === 'bullet') write(`•  ${block.text}`, { size: 11, indent: 12 })
      else if (block.kind === 'code') write(block.text, { size: 9, color: '#374151', gap: 8 })
      else if (block.kind === 'image') {
        if (!block.image) { write(`[Image: ${block.label}]`, { bold: true, size: 10, color: '#6b7280' }); continue }
        const size = fit(block.image, width, 360)
        if (pdf.y + size.height > pdf.page.height - 80) pdf.addPage()
        pdf.image(block.image.data, pdf.page.margins.left + (width - size.width) / 2, pdf.y, size)
        pdf.y += size.height + 6
        if (block.image.caption) write(block.image.caption, { size: 8, color: '#6b7280', gap: 10 })
      } else write(block.text, { size: 11 })
    }
    pdf.end()
  })
}

export type DeckSlide = {
  title: string
  bullets: string[]
  visual: string | null
  image: string | null
  diagram: string | null
  diagramIndex: number | null
  notes: string | null
}

// Parses "## Slide N: Title" sections produced by the presentation template.
export function parseSlideDeck(content: string): DeckSlide[] {
  const normalized = content.replace(/\r\n?/g, '\n')
  const sections = normalized.split(/^#{1,4}\s*Slide\s+\d+\s*[:.\-–]?\s*/gim)
  let diagramCount = (sections[0].match(/```mermaid/g) ?? []).length
  return sections.slice(1).map((section) => {
    const [titleLine, ...rest] = section.split('\n')
    const body = rest.join('\n')
    const diagram = body.match(/```mermaid\s*\n([\s\S]*?)```/)?.[1]?.trim() ?? null
    const diagramIndex = diagram ? diagramCount : null
    diagramCount += (body.match(/```mermaid/g) ?? []).length
    const withoutCode = body.replace(/```[\s\S]*?```/g, '')
    const bullets = withoutCode.split('\n').map((line) => line.trim()).filter((line) => /^[-*•]\s+/.test(line)).map((line) => stripInlineMarkdown(line.replace(/^[-*•]\s+/, '')))
    const visual = withoutCode.match(/\*\*Visual:?\*\*:?\s*(.+)/i)?.[1] ?? null
    const image = withoutCode.match(/\[IMAGE:\s*([^\]]+)\]/)?.[1] ?? null
    const notes = withoutCode.match(/\*\*Speaker notes:?\*\*:?\s*([\s\S]+?)(?=\n\s*\n|$)/i)?.[1] ?? null
    return {
      title: stripInlineMarkdown(titleLine) || 'Slide',
      bullets,
      visual: visual ? stripInlineMarkdown(visual) : null,
      image: image ? image.trim() : null,
      diagram,
      diagramIndex,
      notes: notes ? stripInlineMarkdown(notes) : null,
    }
  })
}

function addDeckSlide(presentation: PptxGenJS, item: DeckSlide, assets: ExportAssets) {
  const slide = presentation.addSlide()
  const fontFace = hasIndicScript(`${item.title} ${item.bullets.join(' ')}`) ? INDIC_OFFICE_FONT : 'Aptos'
  slide.background = { color: 'F5FAF7' }
  slide.addText(item.title, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontFace, fontSize: 26, bold: true, color: '14532D', fit: 'shrink' })
  const picture = (item.diagramIndex !== null ? assets.diagrams[item.diagramIndex] : null) ?? (item.image ? assets.images.get(item.image) : undefined) ?? null
  const hasVisual = Boolean(picture || item.image || item.diagram || item.visual)
  const bullets = item.bullets.length ? item.bullets : ['(No bullet points)']
  slide.addText(bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), {
    x: 0.7, y: 1.3, w: hasVisual ? 7.2 : 11.8, h: 5.4, fontFace, fontSize: 17, color: '1F2937', valign: 'top', paraSpaceAfter: 10, fit: 'shrink',
  })
  if (picture) {
    const size = fit(picture, 4.5 * 96, 4.6 * 96)
    const w = size.width / 96
    const h = size.height / 96
    slide.addImage({ data: `image/${picture.type === 'jpg' ? 'jpeg' : 'png'};base64,${picture.data.toString('base64')}`, x: 8.2 + (4.5 - w) / 2, y: 1.3 + (4.6 - h) / 2, w, h })
    if (picture.caption) slide.addText(picture.caption, { x: 8.2, y: 6.0, w: 4.5, h: 0.5, fontFace: 'Aptos', fontSize: 9, color: '6B7280', align: 'center', fit: 'shrink' })
  } else if (hasVisual) {
    const label = item.diagram ? `Diagram\n\n${item.diagram.split('\n').slice(0, 12).join('\n')}` : `Image: ${item.image ?? ''}\n\n${item.visual ?? ''}`
    slide.addText(label, {
      shape: presentation.ShapeType.roundRect, x: 8.2, y: 1.3, w: 4.5, h: 4.6, fill: { color: 'E8F3EC' }, line: { color: '86B49A', dashType: 'dash' },
      fontFace, fontSize: 12, color: '14532D', align: 'center', valign: 'middle', fit: 'shrink',
    })
  }
  if (item.notes) slide.addNotes(item.notes)
}

export async function createPptx(title: string, content: string, assets: ExportAssets = EMPTY_ASSETS) {
  const presentation = new PptxGenJS()
  presentation.layout = 'LAYOUT_WIDE'
  presentation.title = title
  presentation.author = 'Teach Easy'

  const deck = parseSlideDeck(content)
  if (deck.length) {
    deck.forEach((item) => addDeckSlide(presentation, item, assets))
  } else {
    const lines = content.replace(/\r\n?/g, '\n').split('\n').map((line) => stripInlineMarkdown(line.replace(/^#{1,4}\s+|^[-*]\s+/, ''))).filter(Boolean)
    const groups: string[][] = []
    for (let offset = 0; offset < lines.length; offset += 6) groups.push(lines.slice(offset, offset + 6))
    ;(groups.length ? groups : [['No generated content.']]).forEach((items, index) => addDeckSlide(presentation, {
      title: index === 0 ? title : `${title} · ${index + 1}`, bullets: items, visual: null, image: null, diagram: null, diagramIndex: null, notes: null,
    }, assets))
  }

  const output = await presentation.write({ outputType: 'nodebuffer' })
  if (Buffer.isBuffer(output)) return output
  if (output instanceof Uint8Array) return Buffer.from(output)
  if (output instanceof ArrayBuffer) return Buffer.from(new Uint8Array(output))
  throw new Error('PowerPoint exporter returned an unexpected binary format.')
}
