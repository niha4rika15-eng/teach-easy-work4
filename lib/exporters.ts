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

  const lines = getParagraphs(content)
  const groups: string[][] = []
  for (let offset = 0; offset < lines.length; offset += 6) {
    groups.push(lines.slice(offset, offset + 6))
  }
  const slides = groups.length ? groups : [['No generated content.']]

  slides.forEach((items, index) => {
    const slide = presentation.addSlide()
    slide.background = { color: 'F5FAF7' }
    slide.addText(index === 0 ? title : `${title} · ${index + 1}`, {
      x: 0.6,
      y: 0.35,
      w: 12,
      h: 0.6,
      fontFace: 'Aptos Display',
      fontSize: 24,
      bold: true,
      color: '14532D',
      breakLine: false,
      fit: 'shrink',
    })
    slide.addText(items.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), {
      x: 0.8,
      y: 1.25,
      w: 11.6,
      h: 5.4,
      fontFace: 'Aptos',
      fontSize: 18,
      color: '1F2937',
      breakLine: false,
      valign: 'top',
      paraSpaceAfter: 12,
      fit: 'shrink',
    })
  })

  const output = await presentation.write({ outputType: 'nodebuffer' })
  if (output instanceof Uint8Array) return Buffer.from(output)
  if (output instanceof ArrayBuffer) return Buffer.from(output)
  throw new Error('Presentation exporter returned an unexpected binary format.')
}
