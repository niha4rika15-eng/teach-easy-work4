export type BoundaryStatus = 'available' | 'requires-configuration' | 'not-configured'

export type FeatureBoundary = {
  key: 'rag' | 'embeddings' | 'persistence' | 'storage-rls' | 'evaluation' | 'notifications' | 'google-forms'
  label: string
  status: BoundaryStatus
  description: string
  nextStep: string
}

export const FEATURE_BOUNDARIES: readonly FeatureBoundary[] = [
  {
    key: 'rag',
    label: 'Research-grounded generation',
    status: 'requires-configuration',
    description: 'Semantic retrieval, upload, ingestion, and citation display are implemented. Runtime use requires the RAG migrations, professor permissions, and server-side Gemini (or OpenAI) credentials.',
    nextStep: 'Apply the reviewed Supabase migrations, configure GEMINI_API_KEY in Vercel, then upload and test a source document.',
  },
  {
    key: 'embeddings',
    label: 'Semantic search and embeddings',
    status: 'requires-configuration',
    description: 'Documents and queries use 1,536-dimension gemini-embedding-001 (or OpenAI text-embedding-3-small) vectors and authenticated pgvector cosine search.',
    nextStep: 'Ensure the vector extension and match_document_chunks function from the RAG migration are present in Supabase.',
  },
  {
    key: 'persistence',
    label: 'Server-side persistence',
    status: 'requires-configuration',
    description: 'Generated drafts and quiz links are saved to generations and quiz_forms under their authenticated owner.',
    nextStep: 'Apply the base migration and verify row-level security in the target Supabase project.',
  },
  {
    key: 'storage-rls',
    label: 'Supabase storage and RLS',
    status: 'requires-configuration',
    description: 'RAG source binaries are parsed transiently. Student-facing shared files use a private Supabase bucket with role and ownership policies.',
    nextStep: 'Apply the shared-material storage migration and verify bucket policies in Supabase.',
  },
  {
    key: 'evaluation',
    label: 'Evaluation and score persistence',
    status: 'requires-configuration',
    description: 'An LLM rubric estimates NEP 2020 alignment and content quality; source-based evidence risk is estimated only when passages are retrieved. These are not certifications or independent fact-checks.',
    nextStep: 'Configure the server-side Gemini or OpenAI key; review generated scores against primary sources and the evaluation rubric.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    status: 'not-configured',
    description: 'The app does not send email, push, or scheduled notifications.',
    nextStep: 'Configure a delivery provider and notification preferences before sending messages.',
  },
  {
    key: 'google-forms',
    label: 'Google Forms publishing',
    status: 'requires-configuration',
    description: 'Professors can publish quizzes through a configured Apps Script web app and receive student/editor links. A Google API key alone does not provide the OAuth permissions required to create forms.',
    nextStep: 'Set GOOGLE_APPS_SCRIPT_URL in Vercel and verify the script returns Google Forms URLs.',
  },
] as const

export function getUnavailableBoundaries() {
  return FEATURE_BOUNDARIES.filter((boundary) => boundary.status !== 'available')
}

export function isBoundaryAvailable(key: FeatureBoundary['key']) {
  return FEATURE_BOUNDARIES.some((boundary) => boundary.key === key && boundary.status === 'available')
}
