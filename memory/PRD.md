# Teach Easy – audit & fix log
Original request: audit Next.js + Supabase "Teach Easy" (JNU research framework): fix unauth 500 on /api/professor/documents, built-in template fallbacks, RAG upload/embedding/retrieval scoping, storage/RLS sharing security, quiz strict JSON + Google Forms Apps Script links, honest score units/"Not evaluated".
User choices: test against real Supabase (keys pending), move loose root files into proper folders, edit migrations in place.

## Done (2026-11-03)
- lib/api-auth.ts guard: never throws; 401/403/503 JSON. Lazy pdf-parse + serverExternalPackages; proxy try/catch.
- Templates: core 4 render immediately, loadPromptTemplates survives empty/offline/malformed table.
- Upload magic-byte validation; EMBEDDING_DIMENSIONS shared + test vs SQL; retrieval ownership re-check.
- Migrations: shared_materials scoped by student_ids, owner-folder file_url, storage read policy, template author-only edits.
- lib/quiz.ts strict schema; forms-create requires both student+editor links; 503 when Apps Script unconfigured.
- lib/scores.ts units + "Not evaluated"; dashboards/metrics fixed.
- Restructure: root modules -> lib/rag, tests/, components/ui, hooks; stale duplicates removed.
- Build, tsc, lint (0 errors), 26 unit tests pass; local curl: all APIs 401 JSON when signed out.

## Backlog
- Live Supabase verification (needs URL/anon key + apply migrations), per-student sharing picker UI, OCR for scanned PDFs.

## Session 2 (2026-11-03)
- Live Supabase probed (read-only): schema differs from repo (no prompt_templates/shared_materials/generations/document_chunks; legacy professor_documents/usage_logs; anon can read profiles).
- Migrations made safe for that project: legacy tables renamed *_legacy, profiles columns/roles normalized, all old profile policies dropped, storage grant wrapped.
- AI provider switched to Gemini (gemini-3.8-flash with fallbacks; gemini-embedding-001 @1536, normalized); OpenAI fallback. Provider-specific relevance cutoff (Gemini 0.6).
- Forms: student link must be /viewform or forms.gle; editor must be /edit.
- Testing agent iteration_1: 17/17 HTTP, 27/27 unit, tsc + lint clean.
- Pending (user): run 4 migrations in Supabase SQL editor; set geminiapi_script, openai_api_key, google_gorm_api in Vercel; rotate Gemini key pasted in chat; then test signed-in flows.
- Session 3: server secrets read via lib/env.ts (geminiapi_script, openai_api_key, google_gorm_api first; standard names as fallbacks). Test iteration_2 passed.
- Session 4 (2026-11-03): per-template generation guides (lib/generation-guides.ts: PPT 8-15 slides w/ [IMAGE]/Mermaid + notes; visual notes Mermaid/ASCII/tables; structured notes rigorous outline using syllabus), full pasted-input injection (non-overlapping 4k passages), 12 doc passages, 240k context, format+citation retry, evaluation retry; GeneratedContent renderer (Markdown tables, Mermaid, image hooks); slide-aware PPTX export; native-script language instructions (live-tested Hindi/Telugu/Bengali/Marathi); Gemini timeout fallback; /admin/users page + admin nav; admin promotion SQL in migration 20261017223000; Apps Script 401 guidance + docs/google-apps-script/Code.gs. Test iteration_3 passed.
- Blocked: admin password rejected by Supabase; Apps Script deployment requires sign-in (401); migrations not yet applied.
