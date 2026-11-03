import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocx, createPdf, createPptx } from './lib/exporters'

test('DOCX exporter creates a valid zipped document', async () => {
  const output = await createDocx('Lesson notes', '# Key idea\n- First point')
  assert.equal(output.subarray(0, 2).toString('ascii'), 'PK')
})

test('PDF exporter creates a valid PDF for Latin text', async () => {
  const output = await createPdf('Lesson notes', 'Evidence-based teaching notes.')
  assert.equal(output.subarray(0, 4).toString('ascii'), '%PDF')
})

test('PDF exporter clearly rejects unsupported non-Latin characters', async () => {
  assert.throws(() => createPdf('Notes', 'हिंदी'), /Use DOCX or PPTX/)
})

test('PPTX exporter creates a valid zipped presentation', async () => {
  const output = await createPptx('Lesson slides', 'Slide one\nPoint one\nPoint two')
  assert.equal(output.subarray(0, 2).toString('ascii'), 'PK')
})
