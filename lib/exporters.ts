import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import PDFDocument from 'pdfkit'
import PptxGenJS from 'pptxgenjs'

function getParagraphs(content: string) {
  return content.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean)
}

export function createDocx(title: string, content: string) {
  const paragraphs = getParagraphs(content).map((line) => {
    if (/^#{1,3}\s+/.test(line)) {
      return new Paragraph({
        text: line.replace(/^#{1,3}\s+/, ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
      })
    }
    if (/^[-*]\s+/.test(line)) {
      return new Paragraph({
        text: line.replace(/^[-*]\s+/, ''),
        bullet: { level: 0 },
      })
    }
    return new Paragraph({ children: [new TextRun(line)], spacing: { after: 120 } })
  })

  const document = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 240 } }),
        ...paragraphs,
      ],
    }],
  })
  return Packer.toBuffer(document)
}

export function createPdf(title: string, content: string) {
  if (Array.from(content).some((character) => character.codePointAt(0)! > 255)) {
    throw new Error('PDF export supports Latin-1 text. Use DOCX or PPTX to preserve non-Latin scripts.')
  }

  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 } })
    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.on('error', reject)
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.font('Helvetica-Bold').fontSize(20).fillColor('#14532d').text(title, { paragraphGap: 12 })
    pdf.moveDown()
    pdf.font('Helvetica').fontSize(11).fillColor('#111827').text(content, {
      lineGap: 3,
      paragraphGap: 8,
      width: 483,
    })
    pdf.end()
  })
}

export async function createPptx(title: string, content: string) {
  const presentation = new PptxGenJS()
  presentation.layout = 'LAYOUT_WIDE'
  presentation.author = 'Teach Easy'
  presentation.subject = 'Generated educational content'
  presentation.title = title
  presentation.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
  }

  const deck = parseSlideDeck(content)
  if (deck.length) {
    deck.forEach((item) => addDeckSlide(presentation, item))
  } else {
    const lines = getParagraphs(content)
    const groups: string[][] = []
    for (let offset = 0; offset < lines.length; offset += 6) groups.push(lines.slice(offset, offset + 6))
    const slides = groups.length ? groups : [['No generated content.']]
    slides.forEach((items, index) => addDeckSlide(presentation, {
      title: index === 0 ? title : `${title} · ${index + 1}`,
      bullets: items,
      visual: null,
      image: null,
      diagram: null,
      notes: null,
    }))
  }

  const output = await presentation.write({ outputType: 'nodebuffer' })
  if (output instanceof Uint8Array) return Buffer.from(output)
  if (output instanceof ArrayBuffer) return Buffer.from(output)
  throw new Error('Presentation exporter returned an unexpected binary format.')
}

export type DeckSlide = {
  title: string
  bullets: string[]
  visual: string | null
  image: string | null
  diagram: string | null
  notes: string | null
}

const stripMarkdown = (value: string) => value.replace(/\*\*/g, '').replace(/`/g, '').trim()

// Parses "## Slide N: Title" sections produced by the presentation template.
export function parseSlideDeck(content: string): DeckSlide[] {
  const sections = content.replace(/\r\n?/g, '\n').split(/^##\s*Slide\s+\d+\s*[:.\-–]?\s*/gim).slice(1)
  return sections.map((section) => {
    const [titleLine, ...rest] = section.split('\n')
    const body = rest.join('\n')
    const diagram = body.match(/```mermaid\s*\n([\s\S]*?)```/)?.[1]?.trim() ?? null
    const withoutDiagram = body.replace(/```[\s\S]*?```/g, '')
    const bullets = withoutDiagram.split('\n').map((line) => line.trim()).filter((line) => /^[-*•]\s+/.test(line)).map((line) => stripMarkdown(line.replace(/^[-*•]\s+/, '')))
    const visual = withoutDiagram.match(/\*\*Visual:?\*\*:?\s*(.+)/i)?.[1] ?? null
    const image = withoutDiagram.match(/\[IMAGE:\s*([^\]]+)\]/)?.[1] ?? null
    const notes = withoutDiagram.match(/\*\*Speaker notes:?\*\*:?\s*([\s\S]+?)(?=\n\s*\n|$)/i)?.[1] ?? null
    return {
      title: stripMarkdown(titleLine) || 'Slide',
      bullets,
      visual: visual ? stripMarkdown(visual) : null,
      image: image ? image.trim() : null,
      diagram,
      notes: notes ? stripMarkdown(notes) : null,
    }
  })
}

function addDeckSlide(presentation: PptxGenJS, item: DeckSlide) {
  const slide = presentation.addSlide()
  slide.background = { color: 'F5FAF7' }
  slide.addText(item.title, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontFace: 'Aptos Display', fontSize: 26, bold: true, color: '14532D', fit: 'shrink' })
  const hasVisual = Boolean(item.image || item.diagram || item.visual)
  const bullets = item.bullets.length ? item.bullets : ['(No bullet points)']
  slide.addText(bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), {
    x: 0.7, y: 1.3, w: hasVisual ? 7.2 : 11.8, h: 5.4, fontFace: 'Aptos', fontSize: 17, color: '1F2937', valign: 'top', paraSpaceAfter: 10, fit: 'shrink',
  })
  if (hasVisual) {
    const label = item.diagram
      ? `Diagram\n\n${item.diagram.split('\n').slice(0, 12).join('\n')}`
      : `Image placeholder\n${item.image ?? ''}\n\n${item.visual ?? ''}`
    slide.addText(label, {
      shape: presentation.ShapeType.roundRect, x: 8.2, y: 1.3, w: 4.5, h: 4.6, fill: { color: 'E8F3EC' }, line: { color: '86B49A', dashType: 'dash' },
      fontFace: 'Aptos', fontSize: 12, color: '14532D', align: 'center', valign: 'middle', fit: 'shrink',
    })
  }
  if (item.notes) slide.addNotes(item.notes)
}
