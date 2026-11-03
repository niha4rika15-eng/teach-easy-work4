import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocx, createPdf } from '../lib/exporters'
import { extractDocumentText } from '../lib/document-extraction'

test('extracts UTF-8 text documents', async () => {
  const text = await extractDocumentText('notes.txt', Buffer.from('Physics notes: ऊर्जा'))
  assert.match(text, /ऊर्जा/)
})

test('extracts text from generated DOCX documents', async () => {
  const document = await createDocx('Lesson notes', 'Photosynthesis converts light to energy.')
  const text = await extractDocumentText('notes.docx', document)
  assert.match(text, /Photosynthesis converts light to energy/)
})

test('extracts selectable text from generated PDFs', async () => {
  const document = await createPdf('Lesson notes', 'Photosynthesis converts light to energy.')
  const text = await extractDocumentText('notes.pdf', document)
  assert.match(text, /Photosynthesis converts light to energy/)
})

test('rejects unsupported file types', async () => {
  await assert.rejects(
    extractDocumentText('notes.rtf', Buffer.from('text')),
    /Unsupported file type/,
  )
})
