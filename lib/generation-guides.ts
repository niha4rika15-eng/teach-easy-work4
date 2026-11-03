export type GenerationGuide = {
  instructions: string
  maxTokens: number
  validate: (text: string) => string | null
}

const LANGUAGE_SCRIPTS: Record<string, string> = {
  Hindi: 'Devanagari script (हिन्दी)',
  Marathi: 'Devanagari script (मराठी)',
  Bengali: 'Bengali script (বাংলা)',
  Telugu: 'Telugu script (తెలుగు)',
  English: 'English',
}

export function languageInstruction(language: string) {
  const script = LANGUAGE_SCRIPTS[language] ?? language
  return [
    `Write every heading, bullet, explanation, table cell, and speaker note in ${language}, using ${script}. Do not transliterate into Latin letters.`,
    'Keep technical terms understandable: give the English term in parentheses after its first use when helpful.',
    'Inside Mermaid diagrams, always wrap node labels in double quotes, e.g. A["लेबल"], so any script renders correctly.',
    'Never use LaTeX or $...$ math. Write formulas with Unicode, e.g. 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.',
  ].join(' ')
}

function count(pattern: RegExp, text: string) {
  return (text.match(pattern) ?? []).length
}

const PPT: GenerationGuide = {
  maxTokens: 12000,
  instructions: `Produce a complete, presentation-ready slide deck in Markdown.
- Use the requested number of slides, but never fewer than 8 and no more than 15 (default 10).
- Required arc: title slide, agenda, learning objectives, 5+ substantive content slides, a worked example or case study, recap, and a discussion/assessment slide.
- Format EVERY slide exactly like this:
## Slide N: <slide title>
**Key points:**
- 4 to 6 bullets, each a complete, specific idea (facts, definitions, mechanisms, examples, numbers) — never one-word bullets
**Visual:** one sentence describing the image, chart, or diagram that should appear on the slide
[IMAGE: <3-6 word image search query>]   (or, for processes/relationships, a \`\`\`mermaid diagram instead)
**Speaker notes:** 3 to 5 sentences the presenter can say
- Include at least two slides with Mermaid diagrams and at least four [IMAGE: ...] placement hooks.
- [IMAGE: ...] queries must name a concrete, photographable subject from the topic (e.g. "chloroplast micrograph", "leaf cross section"), never abstract ideas such as agenda, objectives, classroom, discussion, icons, or checklists. Agenda, objectives, and discussion slides need no image.`,
  validate: (text) => {
    const slides = count(/^##\s*Slide\s+\d+/gim, text)
    if (slides < 8) return `Only ${slides} slides were produced; at least 8 complete slides are required.`
    if (count(/\[IMAGE:[^\]]+\]/g, text) + count(/```mermaid/g, text) < 4) return 'Add image placement hooks ([IMAGE: ...]) or Mermaid diagrams to the slides.'
    return null
  },
}

const VISUAL_NOTES: GenerationGuide = {
  maxTokens: 10000,
  instructions: `Produce VISUAL notes — the structure should be mostly diagrams, tables, and visual layout, with short connecting text (no long paragraphs).
Required components, in this order:
1. "## At a glance" — a Markdown summary table (Concept | Meaning | Example).
2. "## Concept map" — a \`\`\`mermaid flowchart (graph TD or mindmap) connecting the main ideas.
3. "## Process / flow" — a second \`\`\`mermaid diagram (flowchart, sequenceDiagram, or timeline) showing a process, cause-and-effect, or chronology.
4. "## Text flow chart" — an ASCII flow chart inside a \`\`\`text block using boxes and arrows (e.g. [Input] --> [Step] --> [Output]).
5. "## Compare & contrast" — a second Markdown table comparing related ideas.
6. "## Key takeaways" — 5-8 short bullets, each starting with a bold keyword.
7. "## Legend" — explain diagram symbols.
Use visual layout cues: blockquote callouts like "> KEY IDEA:", "> REMEMBER:", "> COMMON MISTAKE:".
Mermaid must be valid syntax: quote every node label, avoid parentheses inside unquoted labels, one statement per line.`,
  validate: (text) => {
    if (count(/```mermaid/g, text) < 2) return 'Visual notes need at least two Mermaid diagrams.'
    if (count(/^\|.*\|\s*$/gm, text) < 4) return 'Visual notes need Markdown summary tables.'
    if (!/```text/.test(text)) return 'Visual notes need an ASCII flow chart in a ```text block.'
    return null
  },
}

const STRUCTURED_NOTES: GenerationGuide = {
  maxTokens: 12000,
  instructions: `Produce rigorous, comprehensive STRUCTURED academic notes (outline-based synthesis), not a visual summary.
- Use EVERY provided input: topic, audience, detail level, any syllabus/learning outcomes in the variables, all pasted text, and all reference passages. Do not skip a supplied passage; integrate each into the relevant section.
- Required outline:
# <Topic>
## 1. Learning outcomes (mapped to the syllabus/inputs)
## 2. Overview and context
## 3+. Core concepts — numbered sections with sub-sections (3.1, 3.2 ...), each containing a precise definition, explanation of mechanism/theory, an example, and its significance
## Key terms (glossary table: Term | Definition)
## Critical analysis (debates, limitations, applications, interdisciplinary links)
## Summary (bullet synthesis)
## Review questions (5-8, mix of recall and higher-order)
## Sources used (list each [S#] that was cited)
- Write with academic precision: correct terminology, accurate relationships, no filler. Prefer depth over brevity.`,
  validate: (text) => {
    if (count(/^##\s+/gm, text) < 6) return 'The notes are missing required outline sections.'
    if (text.length < 2500) return 'The notes are too short to be comprehensive.'
    return null
  },
}

const QUIZ: GenerationGuide = {
  maxTokens: 8000,
  instructions: 'For a quiz, return only valid JSON with this exact shape and no other top-level keys: {"questions":[{"question":"...","options":["...","..."],"correctAnswer":"...","points":1,"explanation":"..."}]}. Use 2-8 unique options per question and at most 50 questions. Every correctAnswer must exactly match one option. Put any required source citations in the explanation.',
  validate: () => null,
}

const DEFAULT_GUIDE: GenerationGuide = { maxTokens: 8000, instructions: '', validate: () => null }

const GUIDES: Record<string, GenerationGuide> = {
  ppt_outline: PPT,
  visual_notes: VISUAL_NOTES,
  word_brief: STRUCTURED_NOTES,
  quiz: QUIZ,
}

export function getGenerationGuide(templateType: string): GenerationGuide {
  return GUIDES[templateType] ?? DEFAULT_GUIDE
}
