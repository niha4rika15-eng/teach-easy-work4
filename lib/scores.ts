export const NOT_EVALUATED = 'Not evaluated'
export const SCORE_DISCLAIMER = 'Model-estimated rubric score — not an official NEP certification or independent fact-check.'

export function toScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export function averageScore(values: unknown[]): number | null {
  const scores = values.map(toScore).filter((value): value is number => value !== null)
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null
}

// NEP 2020 alignment estimate, stored on a 0-100 scale.
export function formatNepScore(value: unknown, digits = 0) {
  const score = toScore(value)
  return score === null ? NOT_EVALUATED : `${score.toFixed(digits)}/100`
}

// Content quality estimate, stored on a 0-10 scale.
export function formatQualityScore(value: unknown, digits = 0) {
  const score = toScore(value)
  return score === null ? NOT_EVALUATED : `${score.toFixed(digits)}/10`
}

// Evidence risk is stored as a 0-1 index (higher = more unsupported-claim risk); shown on a 0-100 scale.
export function formatEvidenceRisk(index: unknown) {
  const score = toScore(index)
  return score === null ? NOT_EVALUATED : `${Math.round(score * 100)}/100`
}
