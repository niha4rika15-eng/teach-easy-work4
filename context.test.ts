import assert from 'node:assert/strict'
import test from 'node:test'
import { combineSynthesisContext } from './context'
import type { RetrievedChunk } from './retrieval'

const sourceChunk: RetrievedChunk = {
  id: 'chunk-1',
  document_id: 'document-1',
  title: 'Lecture source',
  content: 'Formula: E = mc^2',
  source_metadata: { start: 0, end: 15 },
  similarity: 1,
}

test('combineSynthesisContext includes the complete prompt and every retrieved chunk', () => {
  const context = combineSynthesisContext('Keep this complete.', [sourceChunk])

  assert.match(context, /Keep this complete\./)
  assert.match(context, /Lecture source/)
  assert.match(context, /Formula: E = mc\^2/)
})

test('combineSynthesisContext rejects oversized context instead of truncating it', () => {
  assert.throws(
    () => combineSynthesisContext('x'.repeat(200_001), []),
    /No source was truncated/,
  )
})
