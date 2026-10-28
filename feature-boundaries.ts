export type BoundaryStatus = 'available' | 'not-configured'

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
    status: 'not-configured',
    description: 'Synthesis can include all professor-owned document chunks when stored-document context is selected and the reviewed RAG migration is installed.',
    nextStep: 'Install the reviewed RAG migration and ingest professor-owned source documents before enabling stored context.',
  },
  {
    key: 'embeddings',
    label: 'Semantic search and embeddings',
    status: 'not-configured',
    description: 'The synthesis route includes complete stored document text rather than similarity-filtering through vector search.',
    nextStep: 'Enable semantic selection only if the workflow should trade exhaustive context for relevance-based retrieval.',
  },
  {
    key: 'persistence',
    label: 'Server-side persistence',
    status: 'not-configured',
    description: 'Generated drafts and Google Form links are saved only when the configured Supabase tables and ownership policies are available.',
    nextStep: 'Verify the generated-content, quiz, and usage-log tables and their RLS policies in the target Supabase project.',
  },
  {
    key: 'storage-rls',
    label: 'Supabase storage and RLS',
    status: 'not-configured',
    description: 'No file bucket, upload policy, or new RLS policy is introduced by this safe build.',
    nextStep: 'Review the existing schema, choose a bucket, and apply least-privilege storage and table policies through the approved Supabase workflow.',
  },
  {
    key: 'evaluation',
    label: 'Evaluation and score persistence',
    status: 'not-configured',
    description: 'No NEP, fact-check, or quality score is calculated or persisted.',
    nextStep: 'Define evaluation inputs, scoring criteria, retention, and ownership before adding a versioned migration and server-side evaluator.',
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
    status: 'available',
    description: 'Professors can publish quizzes through the configured Apps Script webhook and receive live student/editor links.',
    nextStep: 'Keep the Apps Script endpoint configured and verify it returns Google Forms URLs.',
  },
] as const

export function getUnavailableBoundaries() {
  return FEATURE_BOUNDARIES.filter((boundary) => boundary.status === 'not-configured')
}

export function isBoundaryAvailable(key: FeatureBoundary['key']) {
  return FEATURE_BOUNDARIES.some((boundary) => boundary.key === key && boundary.status === 'available')
}
