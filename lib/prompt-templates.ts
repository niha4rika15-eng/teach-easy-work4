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

function parseVariables(value: unknown): string[] {
  let raw = value
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return [] }
  }
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

// Drops malformed database rows so a bad seed can never break the template UI.
function normalizeTemplate(row: unknown): PromptTemplate | null {
  if (typeof row !== 'object' || row === null) return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.template_type !== 'string' || typeof record.system_prompt !== 'string') return null
  return {
    id: record.id,
    name: record.name,
    template_type: record.template_type,
    system_prompt: record.system_prompt,
    variables: parseVariables(record.variables),
    created_by: typeof record.created_by === 'string' ? record.created_by : undefined,
    created_at: typeof record.created_at === 'string' ? record.created_at : undefined,
  }
}

export function withCorePromptTemplates(templates: unknown[] | null | undefined): PromptTemplate[] {
  const additional = (Array.isArray(templates) ? templates : [])
    .map(normalizeTemplate)
    .filter((template): template is PromptTemplate => template !== null && !CORE_TYPES.has(template.template_type))
  return [...CORE_PROMPT_TEMPLATES, ...additional].sort((a, b) => a.name.localeCompare(b.name))
}

// Always resolves: falls back to the built-in templates when the table is empty, missing, or offline.
export async function loadPromptTemplates(
  fetchRows: () => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ templates: PromptTemplate[]; warning: string | null }> {
  try {
    const { data, error } = await fetchRows()
    return { templates: withCorePromptTemplates(data), warning: error ? error.message : null }
  } catch (error) {
    return { templates: withCorePromptTemplates([]), warning: error instanceof Error ? error.message : 'Saved templates are unavailable.' }
  }
}
