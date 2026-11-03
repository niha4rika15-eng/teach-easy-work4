import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export async function extractDocumentText(fileName: string, bytes: Buffer) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'txt' || extension === 'md') return bytes.toString('utf8')

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer: bytes })
    return result.value
  }

  if (extension === 'pdf') {
    const parser = new PDFParse({ data: new Uint8Array(bytes) })
    try {
      const info = await parser.getInfo()
      if (info.total > 200) throw new Error('PDFs are limited to 200 pages per upload.')
      const result = await parser.getText({ first: 200, pageJoiner: '' })
      return result.text
    } finally {
      await parser.destroy()
    }
  }

  throw new Error('Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.')
}
