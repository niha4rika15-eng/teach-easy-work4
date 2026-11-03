import { z } from 'zod'

export const quizQuestionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
  correctAnswer: z.string().trim().min(1).max(500),
  points: z.number().int().min(1).max(100).default(1),
  explanation: z.string().trim().max(2000).optional(),
}).refine((question) => question.options.includes(question.correctAnswer), {
  message: 'Each correctAnswer must exactly match one of its options.',
}).refine((question) => new Set(question.options).size === question.options.length, {
  message: 'Answer options must be unique.',
})

export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(50),
})

export type Quiz = z.infer<typeof quizSchema>
export type QuizQuestion = z.infer<typeof quizQuestionSchema>

export function parseQuizJson(text: string): { quiz: Quiz } | { error: string } {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return { error: 'Quiz output is not valid JSON.' }
  }
  const result = quizSchema.safeParse(payload)
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Quiz JSON does not match the required structure.' }
  return { quiz: result.data }
}
