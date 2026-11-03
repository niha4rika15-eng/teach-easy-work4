// Live smoke test (calls the configured AI provider). Run: npx tsx --tsconfig tsconfig.json tests/live/generation-smoke.ts
import { createChatCompletion } from '../../lib/ai'
import { getGenerationGuide, languageInstruction } from '../../lib/generation-guides'
import { CORE_PROMPT_TEMPLATES } from '../../lib/prompt-templates'
import { buildEvaluationMessages, parseGenerationEvaluation } from '../../lib/generation-evaluation'
import { parseSlideDeck } from '../../lib/exporters'
import { splitGeneratedContent } from '../../lib/content-segments'

const source = '[S1] Biology notes, passage 1\nPhotosynthesis occurs in chloroplasts. Light-dependent reactions in the thylakoid membranes split water, release oxygen, and produce ATP and NADPH. The Calvin cycle in the stroma uses ATP and NADPH to fix carbon dioxide into glucose via the enzyme RuBisCO.'

async function run(type: string, language: string, variables: Record<string, string>) {
  const template = CORE_PROMPT_TEMPLATES.find((item) => item.template_type === type)!
  const guide = getGenerationGuide(type)
  const system = ['You are a careful academic teaching assistant.', `Template instructions:\n${template.system_prompt}`,
    'Base factual claims on the supplied source passages. Add inline citations using the exact labels [S1].',
    `Output requirements:\n${guide.instructions}`, languageInstruction(language)].join('\n\n')
  const user = `Create the requested learning content using ALL of these inputs:\n${JSON.stringify(variables)}\n\nReference passages:\n${source}`
  const started = Date.now()
  let text = await createChatCompletion([{ role: 'system', content: system }, { role: 'user', content: user }], { jsonObject: type === 'quiz', maxTokens: guide.maxTokens, maxAttempts: 2, timeoutMs: 150_000 })
  const problem = guide.validate(text)
  if (problem) text = await createChatCompletion([{ role: 'system', content: system }, { role: 'user', content: user }, { role: 'user', content: `Fix: ${problem} Rewrite completely.` }], { maxTokens: guide.maxTokens, maxAttempts: 2, timeoutMs: 150_000 })
  const evaluation = parseGenerationEvaluation(await createChatCompletion(buildEvaluationMessages(text, [source]), { jsonObject: true, maxTokens: 2000, maxAttempts: 2 }), true)
  const segments = splitGeneratedContent(text)
  const script = language === 'Hindi' || language === 'Marathi' ? /[\u0900-\u097F]/ : language === 'Telugu' ? /[\u0C00-\u0C7F]/ : language === 'Bengali' ? /[\u0980-\u09FF]/ : /[A-Za-z]/
  console.log(JSON.stringify({
    type, language, seconds: Math.round((Date.now() - started) / 1000), chars: text.length,
    firstValidation: problem ?? 'pass', finalValidation: guide.validate(text) ?? 'pass',
    slides: type === 'ppt_outline' ? parseSlideDeck(text).length : undefined,
    mermaid: segments.filter((item) => item.kind === 'mermaid').length,
    images: segments.filter((item) => item.kind === 'image').length,
    nativeScript: script.test(text), cites: /\[S1\]/.test(text),
    scores: { nep: evaluation.nep_compliance_score, quality: evaluation.quality_score, evidenceRisk: evaluation.evidence_risk_score },
  }))
  return text
}

const ALL_JOBS: Array<[string, string, Record<string, string>]> = [
  ['ppt_outline', 'English', { topic: 'Photosynthesis', num_slides: '10', audience: 'Class 11 biology' }],
  ['visual_notes', 'Hindi', { topic: 'Photosynthesis', audience: 'Class 11', diagram_focus: 'light and dark reactions' }],
  ['word_brief', 'Telugu', { topic: 'Photosynthesis', syllabus: 'Unit 4: light reactions, Calvin cycle, factors affecting photosynthesis', audience: 'Undergraduate', detail_level: 'detailed' }],
  ['word_brief', 'Bengali', { topic: 'Photosynthesis', syllabus: 'Calvin cycle', audience: 'Class 12', detail_level: 'standard' }],
  ['word_brief', 'Marathi', { topic: 'Photosynthesis', syllabus: 'Light reactions and Calvin cycle', audience: 'Class 11', detail_level: 'standard' }],
]
const only = process.argv[2]
const jobs = only ? ALL_JOBS.filter(([type, language]) => `${type}:${language}` === only) : ALL_JOBS
Promise.allSettled(jobs.map(([type, language, variables]) => run(type, language, variables))).then(async (results) => {
  results.forEach((result, index) => { if (result.status === 'rejected') console.log('FAILED', jobs[index][0], jobs[index][1], (result.reason as Error).message) })
  const deck = results[0]
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('tests/live/out', { recursive: true })
  results.forEach((result, index) => { if (result.status === 'fulfilled') writeFileSync(`tests/live/out/gen-${jobs[index][0]}-${jobs[index][1]}.md`, result.value) })
  if (!only && deck.status === 'fulfilled') {
    const { createPptx, createDocx } = await import('../../lib/exporters')
    console.log('pptx bytes', (await createPptx('Photosynthesis', deck.value)).length)
    const hindi = results[1]
    if (hindi.status === 'fulfilled') console.log('hindi docx bytes', (await createDocx('Notes', hindi.value)).length)
  }
})
