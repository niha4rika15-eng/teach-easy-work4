export const SUPPORTED_DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
} as const

export type SupportedExtension = keyof typeof SUPPORTED_DOCUMENT_TYPES
export const MAX_PDF_PAGES = 200

export function getSupportedExtension(fileName: string): SupportedExtension | null {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension && extension in SUPPORTED_DOCUMENT_TYPES ? extension as SupportedExtension : null
}

// Checks the file's magic bytes so a renamed binary cannot pass as a supported document.
export function matchesFileSignature(extension: SupportedExtension, bytes: Buffer) {
  if (extension === 'pdf') return bytes.subarray(0, 5).toString('latin1') === '%PDF-'
  if (extension === 'docx') return bytes[0] === 0x50 && bytes[1] === 0x4b
  return !bytes.subarray(0, 8192).includes(0)
}

export async function extractDocumentText(fileName: string, bytes: Buffer) {
  const extension = getSupportedExtension(fileName)
  if (!extension) throw new Error('Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.')
  if (!matchesFileSignature(extension, bytes)) {
    throw new Error(`The file content does not match its .${extension} extension.`)
  }
  if (extension === 'txt' || extension === 'md') return bytes.toString('utf8')

  if (extension === 'docx') {
    const { default: mammoth } = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: bytes })
    return result.value
  }

  // Loaded lazily so a PDF runtime problem can never break other routes or the auth check.
  await import('pdf-parse/worker')
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(bytes) })
  try {
    const info = await parser.getInfo()
    if (info.total > MAX_PDF_PAGES) throw new Error(`PDFs are limited to ${MAX_PDF_PAGES} pages per upload.`)
    const result = await parser.getText({ first: MAX_PDF_PAGES, pageJoiner: '' })
    return result.text
  } finally {
    await parser.destroy()
  }
}
