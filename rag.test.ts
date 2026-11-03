import assert from 'node:assert/strict'
import test from 'node:test'
import { cosineSimilarity, selectRelevantChunks, type EvidenceChunk } from './retrieval'

function chunk(overrides: Partial<EvidenceChunk> & Pick<EvidenceChunk, 'id' | 'document_id' | 'chunk_index' | 'similarity'>): EvidenceChunk {
  return {
    title: 'Source',
    content: 'Evidence passage',
    ...overrides,
  }
}

test('cosineSimilarity returns expected semantic ranking score', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1)
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0)
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1)
})

test('cosineSimilarity safely rejects incompatible and zero vectors', () => {
  assert.equal(cosineSimilarity([1], [1, 0]), 0)
  assert.equal(cosineSimilarity([0, 0], [1, 0]), 0)
})

test('selectRelevantChunks ranks evidence and avoids adjacent overlapping chunks', () => {
  const chunks = [
    chunk({ id: 'a0', document_id: 'a', chunk_index: 0, similarity: 0.82 }),
    chunk({ id: 'a1', document_id: 'a', chunk_index: 1, similarity: 0.81 }),
    chunk({ id: 'b0', document_id: 'b', chunk_index: 0, similarity: 0.7 }),
    chunk({ id: 'a2', document_id: 'a', chunk_index: 2, similarity: 0.65 }),
  ]

  assert.deepEqual(selectRelevantChunks(chunks).map((item) => item.id), ['a0', 'b0', 'a2'])
})

test('selectRelevantChunks excludes low-similarity noise and observes its limit', () => {
  const chunks = [
    chunk({ id: 'best', document_id: 'a', chunk_index: 0, similarity: 0.8 }),
    chunk({ id: 'weak', document_id: 'b', chunk_index: 0, similarity: 0.19 }),
    chunk({ id: 'next', document_id: 'c', chunk_index: 0, similarity: 0.6 }),
  ]

  assert.deepEqual(selectRelevantChunks(chunks, 1).map((item) => item.id), ['best'])
})
