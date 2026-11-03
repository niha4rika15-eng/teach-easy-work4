export type BuiltInTemplate = {
  id: string
  name: string
  templateType: 'ppt_outline' | 'study_notes' | 'visual_notes' | 'quiz'
  description: string
  fields: readonly string[]
}

export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  { id: 'builtin-presentation', name: 'PPT / Presentation', templateType: 'ppt_outline', description: 'Create a clear, slide-ready lesson structure.', fields: ['topic', 'audience', 'slideCount', 'language'] },
  { id: 'builtin-study-notes', name: 'Study Notes', templateType: 'study_notes', description: 'Turn a topic or source into structured revision notes.', fields: ['topic', 'audience', 'depth', 'language'] },
  { id: 'builtin-visual-notes', name: 'Visual Notes with Diagrams', templateType: 'visual_notes', description: 'Create notes with readable diagram descriptions.', fields: ['topic', 'audience', 'diagramType', 'language'] },
  { id: 'builtin-quiz', name: 'Quiz', templateType: 'quiz', description: 'Create questions with options and verified answers.', fields: ['topic', 'questionCount', 'difficulty', 'language'] },
]

export function getAvailableTemplates(databaseTemplates: BuiltInTemplate[] | null | undefined) {
  const custom = databaseTemplates ?? []
  const builtInIds = new Set(BUILT_IN_TEMPLATES.map((template) => template.templateType))
  return [...BUILT_IN_TEMPLATES, ...custom.filter((template) => !builtInIds.has(template.templateType))]
}
