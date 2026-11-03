import assert from 'node:assert/strict'
import test from 'node:test'
import { getGenerationGuide, languageInstruction } from '../lib/generation-guides'
import { parseSlideDeck, createPptx } from '../lib/exporters'
import { splitGeneratedContent } from '../lib/content-segments'
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

test('script runs keep Indic text in its own font and punctuation in Latin', async () => {
  const { splitScriptRuns } = await import('../lib/content-segments')
  const runs = splitScriptRuns('বাংলা: क्लोरोफिल (ATP) తెలుగు')
  assert.deepEqual(runs.map((run) => run.script), ['bengali', 'latin', 'devanagari', 'latin', 'telugu'])
})

test('PDF export embeds fonts for Hindi, Bengali, and Telugu instead of rejecting them', async () => {
  const { createPdf } = await import('../lib/exporters')
  const pdf = await createPdf('बहुभाषी नोट्स', '# প্রকাশ\n- కిరణజన్య సంయోగక్రియ\n- प्रकाश संश्लेषण')
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
})

test('exports place downloaded images and rendered diagrams', async () => {
  const { createPptx, createDocx, toExportImage } = await import('../lib/exporters')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const image = toExportImage(png, 'caption')!
  assert.equal(image.width, 1)
  const deck = '## Slide 1: A\n**Key points:**\n- x\n[IMAGE: leaf]\n## Slide 2: B\n- y\n```mermaid\ngraph TD\nA-->B\n```\n'
  const assets = { diagrams: [image], images: new Map([['leaf', image]]) }
  const pptx = await createPptx('Deck', deck, assets)
  const docx = await createDocx('Doc', deck, assets)
  assert.ok(pptx.includes(Buffer.from('ppt/media/')))
  assert.ok(docx.includes(Buffer.from('word/media/')))
})

test('image search falls back to shorter keyword queries', async () => {
  const { imageQueryVariants } = await import('../lib/stock-images')
  assert.deepEqual(imageQueryVariants('chloroplast ultrastructure labeled thylakoid stroma diagram'), [
    'chloroplast ultrastructure labeled thylakoid stroma diagram', 'chloroplast ultrastructure thylakoid stroma', 'chloroplast ultrastructure', 'chloroplast',
  ])
})

test('LaTeX-style math becomes readable Unicode and Mermaid has a text fallback', async () => {
  const { cleanMathMarkup, mermaidToText } = await import('../lib/content-segments')
  assert.equal(cleanMathMarkup('Equation: $6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2$'), 'Equation: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂')
  assert.equal(cleanMathMarkup('Costs $5 and $10'), 'Costs $5 and $10')
  assert.equal(mermaidToText('graph TD\nA["Light"] --> B["ATP"]\nB -->|"powers"| C["Calvin cycle"]'), 'Light → ATP\nATP → (powers) Calvin cycle')
})
