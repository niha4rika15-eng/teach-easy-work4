# Teach Easy

## Supabase deployment note

Use Node.js 20.16+ (20.x) or 22.3+, install dependencies with `npm install`, and run the app with `npm run dev`. Copy `.env.example` to `.env.local` for local development. In Vercel, configure the same Supabase public URL and publishable/anon key as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Legacy Vercel variables named `supabase_publicurl` and `supabase_anonkey` are also mapped by `next.config.js`.

The Supabase Auth URL configuration must allow the exact callback URL for each environment, including `http://localhost:3000/auth/callback` and your deployed Vercel domain's `/auth/callback`. Signup uses the current site origin in production; `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` is only used during local development.

Before deploying, review and apply the migrations in order to the intended Supabase project. Do not blindly replay migrations against an existing project; reconcile its migration history first. `20261017120000_add_rag_evaluation_storage.sql` creates the professor document catalog, private vector chunks, role/owner-scoped row policies, and the semantic match function required for retrieval. `20261103030000_add_visual_templates_and_shared_file_storage.sql` adds the visual-notes template type and a private `shared-materials` storage bucket with role/ownership policies for file upload and student access.

The profile trigger assigns new accounts the `student` role because client-supplied signup metadata is not a trusted source for authorization. A professor signup is a request for access, not an assignment; promote professors and administrators through a trusted database or server-side administrative process. After sign-in and email confirmation, routing uses the role stored in `profiles`, not editable user metadata.

## Source library and retrieval-augmented generation

Configure `GEMINI_API_KEY` as a server-only Vercel environment variable (`GEMINI_MODEL` optional, default `gemini-3.8-flash`). Embeddings use `gemini-embedding-001` truncated to 1,536 dimensions and re-normalized, matching the SQL vector column. If `GEMINI_API_KEY` is absent, `OPENAI_API_KEY` is used instead (`gpt-4o-mini` + `text-embedding-3-small`, also 1,536 dimensions). Vectors from different providers are not comparable: re-upload source documents after switching providers. Never prefix these provider secrets with `NEXT_PUBLIC_`.

Professors can index selectable-text PDF, DOCX, TXT, and Markdown files from Professor → Share Materials. Uploads are limited to 4 MB, 200 pages per PDF, and 200,000 extracted characters. Scanned/image-only PDFs need OCR before upload. The app extracts text on the server, hashes the original file, chunks text at paragraph/sentence boundaries with overlap, creates embeddings in batches, and stores the source passages in Supabase; the original binary is not retained. Uploads, grounded generation, and citation persistence require the reviewed RAG migration to be installed.

The professor content studio embeds the topic, performs authenticated pgvector cosine search over only that professor's ready documents, removes adjacent overlapping matches, and supplies up to eight relevant passages to the model. Pasted reference text is semantically ranked the same way. Generated material cites retrieved passages as `[S1]`, `[S2]`, etc.; the UI displays excerpts and similarity signals. Similarity is not a fact-check: review the cited source passages. If no relevant evidence is found, the model is instructed to disclose that rather than claim source grounding. Quiz generation with document grounding is blocked when retrieval finds no usable evidence; turn grounding off to deliberately create a general quiz.

Pasted text is sent to OpenAI for the request. It is not saved with the generation unless the professor enables “Save pasted source with this generation.” Provider data retention is controlled by the OpenAI account and settings.

## Templates, scores, and shared files

Four built-in templates remain available even if the `prompt_templates` table has not been seeded: presentation/PPT, study notes, visual notes with text diagrams, and quizzes. Quizzes are generated as validated JSON for publishing.

Each generation requests a second model pass for rubric estimates: NEP 2020 alignment (0-100), quality (0-10), and, only when source passages were retrieved, estimated evidence risk (0-100; higher means more unsupported-claim risk). These are model-estimated scores, not official NEP certification or independent fact-checking. The UI always shows units (`/100`, `/10`) and displays "Not evaluated" when a score is missing — no default values are substituted. Evidence risk is stored in `generations.hallucination_index` as a 0–1 index and displayed on a 0–100 scale. Scores are saved to the generation record and to `generation_evaluations` when that table is available. If evaluation fails, the generation is still saved and the UI explicitly reports that its scores could not be calculated.

The Share Materials form supports local device uploads to the private Supabase `shared-materials` bucket (up to 25 MB), or an existing HTTPS URL. Shared uploads are accessed using short-lived (15-minute) signed links only after a material record grants access to an authenticated student. A student can read a material only when its `student_ids` array is empty (shared with all students) or contains their user ID; a material may reference only a storage object in its owner's own folder, and stored objects without a material record are readable only by their owner. RAG source uploads remain a separate flow: supported text documents are parsed transiently and indexed, while the original is not retained.

Generated content can be exported as DOCX, PPTX, or PDF. PDF export currently accepts Latin-1 text; choose DOCX or PPTX to preserve non-Latin scripts such as Hindi, Bengali, Marathi, or Telugu.

## Publishing

Quizzes can be published through `POST /api/google/forms-create` using the server-side `GOOGLE_APPS_SCRIPT_URL` setting. The endpoint requires an authenticated professor/admin, accepts structured quiz content from an owned generation, and saves returned links to `quiz_forms`. A Google Forms API key alone does not grant the OAuth permissions needed to create forms; configure an Apps Script web app that has the required access, and set its URL in Vercel. Keep Apps Script credentials server-side; only the Supabase URL and publishable/anon key belong in public client configuration. Confirm the Apps Script endpoint returns valid student and editor links.

## Project layout

- `app/` – routes and API handlers (`app/api/**/route.ts`)
- `lib/` – shared logic: `api-auth.ts` (professor/admin guard that always returns JSON), `quiz.ts` (strict quiz JSON schema), `scores.ts` (score units and "Not evaluated" formatting), `prompt-templates.ts` (built-in template fallbacks), `document-extraction.ts`, and `lib/rag/` (chunking, embeddings, retrieval, ingestion)
- `components/ui/`, `hooks/` – UI primitives
- `tests/` – `npm test` unit tests
- `supabase/migrations/` – schema, RLS, and storage policies

API routes return JSON for every outcome: 401 when signed out, 403 for non-professor roles, 503 when a server dependency (Supabase role lookup, Apps Script URL) is not configured.
