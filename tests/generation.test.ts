import assert from 'node:assert/strict'
import test from 'node:test'
import { getGenerationGuide, languageInstruction } from '../lib/generation-guides'
import { parseSlideDeck, createPptx } from '../lib/exporters'
import { splitGeneratedContent } from '../components/generated-content'
import { CORE_PROMPT_TEMPLATES } from '../lib/prompt-templates'

const slide = (n: number) => `## Slide ${n}: Topic ${n}\n**Key points:**\n- Point A ${n}\n- Point B ${n}\n**Visual:** Diagram of step ${n}\n[IMAGE: leaf cross section ${n}]\n**Speaker notes:** Explain step ${n}.\n`

test('presentation guide requires at least 8 slides with visual hooks', () => {
  const guide = getGenerationGuide('ppt_outline')
  assert.match(guide.validate([1, 2, 3].map(slide).join('\n')) ?? '', /at least 8/)
  assert.equal(guide.validate(Array.from({ length: 10 }, (_, i) => slide(i + 1)).join('\n')), null)
})

test('visual notes and structured notes use separate prompts and validators', () => {
  const visual = CORE_PROMPT_TEMPLATES.find((t) => t.template_type === 'visual_notes')!
  const structured = CORE_PROMPT_TEMPLATES.find((t) => t.template_type === 'word_brief')!
  assert.notEqual(visual.system_prompt, structured.system_prompt)
  assert.ok(structured.variables.includes('syllabus'))
  assert.match(getGenerationGuide('visual_notes').instructions, /mermaid/i)
  assert.match(getGenerationGuide('visual_notes').validate('plain paragraphs only') ?? '', /Mermaid/)
  assert.match(getGenerationGuide('word_brief').validate('## A\nshort') ?? '', /outline|short/)
})

test('language instruction requires native scripts', () => {
  assert.match(languageInstruction('Hindi'), /Devanagari/)
  assert.match(languageInstruction('Telugu'), /Telugu script/)
  assert.match(languageInstruction('Bengali'), /Bengali script/)
})

test('slide deck parser and PPTX exporter keep bullets, image hooks, and notes', async () => {
  const deck = parseSlideDeck(Array.from({ length: 9 }, (_, i) => slide(i + 1)).join('\n'))
  assert.equal(deck.length, 9)
  assert.deepEqual(deck[0].bullets, ['Point A 1', 'Point B 1'])
  assert.equal(deck[0].image, 'leaf cross section 1')
  assert.equal(deck[0].notes, 'Explain step 1.')
  const pptx = await createPptx('Deck', deck.map((_, i) => slide(i + 1)).join('\n'))
  assert.equal(pptx.subarray(0, 2).toString('ascii'), 'PK')
})

test('generated content splitter finds mermaid diagrams and image hooks', () => {
  const segments = splitGeneratedContent('# Notes\n```mermaid\ngraph TD\nA["अ"]-->B\n```\nText [IMAGE: chloroplast] end')
  assert.deepEqual(segments.map((s) => s.kind), ['markdown', 'mermaid', 'markdown', 'image', 'markdown'])
  assert.equal(segments[1].value, 'graph TD\nA["अ"]-->B')
})
