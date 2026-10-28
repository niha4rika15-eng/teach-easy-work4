# teach-easy-work2

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-je8ehsnx)

## Supabase deployment note

The application source has been aligned to the inspected live schema. Before deploying these changes, review and apply `supabase/migrations/20261017223000_harden_profiles_and_sync_schema.sql` in the intended Supabase project. Do not blindly replay the earlier migrations against an existing project; reconcile its migration history first. The separate RAG/evaluation/storage migration remains an explicit prerequisite for the optional stored-document context, evaluation, and storage features.

The profile trigger assigns new accounts the `student` role because client-supplied signup metadata is not a trusted source for authorization. Promote professors and administrators through a trusted database or server-side administrative process.

## Content generation and publishing

The professor content studio uses the OpenAI Chat Completions API for lecture decks, structured notes, and visual notes. Configure `OPENAI_API_KEY` on the server. Slide decks request ten slides with strict structured output; image lookup is enabled when `UNSPLASH_ACCESS_KEY` is configured. Without that optional image key, slides retain their specific visual directions and report that images were not fetched.

Source material entered into the notes/deck form is sent intact up to 200,000 characters; oversized input is rejected rather than truncated. When selected, stored-document context includes all professor-owned document chunks without similarity filtering. Structured notes emphasize comprehensive academic prose, while visual notes include validated Mermaid diagrams and visual callouts.

Quizzes can be published through the Google Apps Script endpoint using the server-side `GOOGLE_APPS_SCRIPT_URL` setting (a project fallback is configured). The endpoint requires an authenticated professor/admin and saves returned form links to the `quizzes` table when Supabase is configured. Verify the Apps Script response includes a student form URL; editor links are optional.
