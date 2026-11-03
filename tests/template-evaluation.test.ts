import assert from 'node:assert/strict'
import test from 'node:test'
import { CORE_PROMPT_TEMPLATES, withCorePromptTemplates } from '../lib/prompt-templates'
import { parseGenerationEvaluation } from '../lib/generation-evaluation'
import type { PromptTemplate } from '../lib/types'

test('built-in templates always include PPT, notes, visual notes, and quiz', () => {
  const templateTypes = CORE_PROMPT_TEMPLATES.map((template) => template.template_type)
  assert.deepEqual(templateTypes, ['ppt_outline', 'word_brief', 'visual_notes', 'quiz'])
  assert.ok(CORE_PROMPT_TEMPLATES.find((template) => template.template_type === 'visual_notes')?.system_prompt.includes('diagrams'))
})

test('database seeding cannot hide built-in templates while additional types remain available', () => {
  const savedQuiz: PromptTemplate = {
    id: 'saved-quiz',
    name: 'Saved Quiz',
    template_type: 'quiz',
    system_prompt: 'Saved instructions',
    variables: ['topic'],
  }
  const savedResearch: PromptTemplate = {
    id: 'saved-research',
    name: 'Saved Research',
    template_type: 'research_paper',
    system_prompt: 'Research instructions',
    variables: ['topic'],
  }
  const templates = withCorePromptTemplates([savedQuiz, savedResearch])
  assert.equal(templates.find((template) => template.template_type === 'quiz')?.id, 'builtin-quiz')
  assert.ok(!templates.some((template) => template.id === 'saved-quiz'))
  assert.ok(templates.some((template) => template.template_type === 'visual_notes'))
  assert.ok(templates.some((template) => template.id === 'saved-research'))
})

test('evaluation parser enforces score bounds and only reports evidence risk for retrieved sources', () => {
  const response = JSON.stringify({
    nep_compliance_score: 82,
    evidence_risk_score: 37,
    quality_score: 8,
    notes: ['Clear learning outcomes'],
  })
  assert.equal(parseGenerationEvaluation(response, true).evidence_risk_score, 37)
  assert.equal(parseGenerationEvaluation(response, false).evidence_risk_score, null)
  assert.throws(() => parseGenerationEvaluation(JSON.stringify({
    nep_compliance_score: 120,
    evidence_risk_score: 0,
    quality_score: 11,
    notes: [],
  }), true))
  assert.throws(() => parseGenerationEvaluation(JSON.stringify({
    nep_compliance_score: 82,
    evidence_risk_score: null,
    quality_score: 8,
    notes: [],
  }), true))
})
