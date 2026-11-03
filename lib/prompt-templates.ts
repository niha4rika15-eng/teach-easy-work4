import type { PromptTemplate } from './types'

export const CORE_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'builtin-ppt-outline',
    name: 'Presentation / PPT Builder',
    template_type: 'ppt_outline',
    system_prompt: 'Create a presentation-ready slide-by-slide outline. For each slide give a concise title, audience-friendly bullets, and speaker notes. Include an opening, logical progression, a recap, and a final discussion prompt. Keep each slide focused and use supplied sources for factual claims.',
    variables: ['topic', 'num_slides', 'audience', 'language'],
  },
  {
    id: 'builtin-study-notes',
    name: 'Study Notes Creator',
    template_type: 'word_brief',
    system_prompt: 'Create clear, well-organized study notes for learners. Use descriptive headings, concise explanations, key terms with definitions, worked examples where useful, a short recap, and review questions. Keep the notes appropriate to the stated audience and cite supplied sources for factual claims.',
    variables: ['topic', 'audience', 'detail_level', 'language'],
  },
  {
    id: 'builtin-visual-notes',
    name: 'Visual Notes & Diagrams',
    template_type: 'visual_notes',
    system_prompt: 'Create learner-friendly visual notes with concise explanations and multiple readable text diagrams. Include at least two diagrams when the topic supports them: a labeled flow diagram, concept map, timeline, comparison table, or cause-and-effect map. Use simple aligned boxes and arrows that remain readable in plain text and exports. Add a brief legend and cite factual claims from supplied sources.',
    variables: ['topic', 'audience', 'diagram_focus', 'language'],
  },
  {
    id: 'builtin-quiz',
    name: 'Quiz & Google Forms',
    template_type: 'quiz',
    system_prompt: 'Create a balanced assessment appropriate to the audience, difficulty, and requested question types. Use clear, unambiguous questions and plausible distractors. Ensure one correct option per multiple-choice question and explain the answer. Follow NEP 2020 assessment principles as a design guide, not as a compliance certification. Base factual questions on supplied sources when available.',
    variables: ['topic', 'num_questions', 'difficulty', 'question_types', 'language'],
  },
]

const CORE_TYPES = new Set(CORE_PROMPT_TEMPLATES.map((template) => template.template_type))

export function withCorePromptTemplates(templates: PromptTemplate[]): PromptTemplate[] {
  const additional = templates.filter((template) => !CORE_TYPES.has(template.template_type))
  return [...CORE_PROMPT_TEMPLATES, ...additional].sort((a, b) => a.name.localeCompare(b.name))
}
