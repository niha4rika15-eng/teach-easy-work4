import assert from 'node:assert/strict'
import test from 'node:test'
import { chunkDocument } from './chunking'

test('chunkDocument creates overlapping ordered chunks', () => {
  const chunks = chunkDocument('a'.repeat(8500), 4000)
  assert.equal(chunks.length, 3)
  assert.equal(chunks[1].sourceMetadata.start, 3600)
  assert.equal(chunks[0].index, 0)
})

test('chunkDocument rejects oversized input', () => {
  assert.throws(() => chunkDocument('a'.repeat(200001)), /size limit/)
})

test('chunkDocument preserves source whitespace and exact chunk offsets', () => {
  const source = ` \n${'a'.repeat(3998)} \n${'b'.repeat(20)} \n`
  const chunks = chunkDocument(source, 4000)

  assert.equal(chunks[0].content, source.slice(0, 4000))
  assert.equal(chunks[0].sourceMetadata.start, 0)
  assert.equal(chunks[0].sourceMetadata.end, 4000)
  assert.equal(chunks[1].sourceMetadata.start, 3600)
  assert.equal(chunks[1].content, source.slice(3600))
})
