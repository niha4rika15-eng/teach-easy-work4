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
