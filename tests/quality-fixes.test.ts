import assert from 'node:assert/strict'
import test from 'node:test'
import { parseQuizJson } from '../lib/quiz'
import { averageScore, formatEvidenceRisk, formatNepScore, formatQualityScore, NOT_EVALUATED } from '../lib/scores'
import { CORE_PROMPT_TEMPLATES, loadPromptTemplates, withCorePromptTemplates } from '../lib/prompt-templates'
import { extractDocumentText, getSupportedExtension, matchesFileSignature } from '../lib/document-extraction'

const validQuiz = {
  questions: [{ question: 'What is 2 + 2?', options: ['3', '4'], correctAnswer: '4', points: 1, explanation: 'Basic sum [S1]' }],
}

test('quiz parser accepts strict, valid quiz JSON', () => {
  const result = parseQuizJson(JSON.stringify(validQuiz))
  assert.ok('quiz' in result)
  assert.equal(result.quiz.questions.length, 1)
})

test('quiz parser rejects non-JSON, mismatched answers, duplicate and excess options', () => {
  assert.ok('error' in parseQuizJson('Here is your quiz: 1. ...'))
  assert.ok('error' in parseQuizJson(JSON.stringify({ questions: [{ ...validQuiz.questions[0], correctAnswer: '5' }] })))
  assert.ok('error' in parseQuizJson(JSON.stringify({ questions: [{ ...validQuiz.questions[0], options: ['4', '4'] }] })))
  const tooMany = Array.from({ length: 9 }, (_, index) => String(index))
  assert.ok('error' in parseQuizJson(JSON.stringify({ questions: [{ ...validQuiz.questions[0], options: tooMany, correctAnswer: '1' }] })))
  assert.ok('error' in parseQuizJson(JSON.stringify({ questions: [] })))
})

test('scores use correct units and show "Not evaluated" instead of fabricated defaults', () => {
  assert.equal(formatNepScore(82), '82/100')
  assert.equal(formatQualityScore(7), '7/10')
  assert.equal(formatEvidenceRisk(0.25), '25/100')
  assert.equal(formatNepScore(null), NOT_EVALUATED)
  assert.equal(formatQualityScore(undefined), NOT_EVALUATED)
  assert.equal(formatEvidenceRisk(null), NOT_EVALUATED)
  assert.equal(averageScore([null, undefined]), null)
  assert.equal(averageScore([80, null, '60']), 70)
})

test('built-in templates render when the template table is empty, offline, or malformed', async () => {
  const coreTypes = CORE_PROMPT_TEMPLATES.map((template) => template.template_type).sort()
  const types = (templates: { template_type: string }[]) => templates.map((template) => template.template_type).sort()

  assert.deepEqual(types(withCorePromptTemplates([])), coreTypes)
  assert.deepEqual(types(withCorePromptTemplates(null)), coreTypes)
  assert.deepEqual(types(withCorePromptTemplates([{ id: 1 }, 'bad', null])), coreTypes)

  const offline = await loadPromptTemplates(() => Promise.reject(new Error('fetch failed')))
  assert.deepEqual(types(offline.templates), coreTypes)
  assert.match(offline.warning ?? '', /fetch failed/)

  const missingTable = await loadPromptTemplates(() => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }))
  assert.deepEqual(types(missingTable.templates), coreTypes)

  const seeded = await loadPromptTemplates(() => Promise.resolve({
    data: [{ id: 'r1', name: 'Research', template_type: 'research_paper', system_prompt: 'x', variables: '["topic"]' }],
    error: null,
  }))
  assert.deepEqual(seeded.templates.find((template) => template.id === 'r1')?.variables, ['topic'])
})

test('upload validation accepts only PDF, DOCX, TXT, and Markdown with matching content', async () => {
  assert.equal(getSupportedExtension('Notes.MD'), 'md')
  assert.equal(getSupportedExtension('slides.pptx'), null)
  assert.equal(matchesFileSignature('pdf', Buffer.from('%PDF-1.7')), true)
  assert.equal(matchesFileSignature('pdf', Buffer.from('MZ fake')), false)
  assert.equal(matchesFileSignature('docx', Buffer.from('plain text')), false)
  assert.equal(matchesFileSignature('txt', Buffer.from([0x68, 0x00, 0x69])), false)
  await assert.rejects(extractDocumentText('renamed.pdf', Buffer.from('not a pdf')), /does not match/)
})

test('embedding dimensions match the pgvector column and retrieval function', async () => {
  const { readFileSync } = await import('node:fs')
  const { EMBEDDING_DIMENSIONS } = await import('../lib/rag/embeddings')
  const sql = readFileSync(new URL('../supabase/migrations/20261017120000_add_rag_evaluation_storage.sql', import.meta.url), 'utf8')
  const declared = Array.from(sql.matchAll(/vector\((\d+)\)/g)).map((match) => Number(match[1]))
  assert.ok(declared.length >= 2)
  assert.ok(declared.every((dimension) => dimension === EMBEDDING_DIMENSIONS))
})

test('gemini vectors are re-normalized and relevance cutoffs depend on the provider', async () => {
  const { normalizeVector, getMinimumRelevantSimilarity } = await import('../lib/rag/embeddings')
  const unit = normalizeVector([3, 4])
  assert.ok(Math.abs(unit[0] - 0.6) < 1e-9 && Math.abs(unit[1] - 0.8) < 1e-9)
  const saved = { gemini: process.env.GEMINI_API_KEY, openai: process.env.OPENAI_API_KEY }
  process.env.GEMINI_API_KEY = 'test'
  assert.equal(getMinimumRelevantSimilarity(), 0.6)
  delete process.env.GEMINI_API_KEY
  process.env.OPENAI_API_KEY = 'test'
  assert.equal(getMinimumRelevantSimilarity(), 0.2)
  if (saved.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.gemini
  if (saved.openai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.openai
})
