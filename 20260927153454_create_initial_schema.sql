/*
# EduAI Platform — Initial Schema

1. Overview
   Multi-tenant educational AI platform with role-based access control.
   Three roles: admin, professor, student. Auth via Supabase email/password.

2. New Tables
   - `profiles`: extends auth.users with role + display name
   - `prompt_templates`: system prompt templates (Lesson Plan, Quiz, PPT, Word Brief, Research Paper)
   - `generations`: LLM generation records with NEP + hallucination scores
   - `quiz_forms`: Google Forms quiz links
   - `shared_materials`: files/materials professors share with students
   - `notifications`: scheduled student milestone/alarm notifications
   - `usage_logs`: telemetry events for admin metrics

3. Security
   - RLS enabled on every table.
   - Profiles: owner read/update; admins read all.
   - Prompt templates: professors+admins CRUD; students read.
   - Generations: owner professor CRUD; admin read all.
   - Quiz forms: owner professor CRUD; admin read all.
   - Shared materials: professor owner CRUD; admin read all; students read shared.
   - Notifications: owner student CRUD; admin read all.
   - Usage logs: admin read all; any authenticated insert.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'professor', 'student')),
  institution text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- prompt_templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('lesson_plan', 'quiz', 'ppt_outline', 'word_brief', 'research_paper')),
  system_prompt text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_templates" ON prompt_templates;
CREATE POLICY "select_templates" ON prompt_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_templates" ON prompt_templates;
CREATE POLICY "insert_templates" ON prompt_templates FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'professor')));

DROP POLICY IF EXISTS "update_templates" ON prompt_templates;
CREATE POLICY "update_templates" ON prompt_templates FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'professor')));

DROP POLICY IF EXISTS "delete_templates" ON prompt_templates;
CREATE POLICY "delete_templates" ON prompt_templates FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'professor')));

-- generations
CREATE TABLE IF NOT EXISTS generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  target_language text NOT NULL,
  input_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_content text,
  training_opt_in boolean DEFAULT false,
  generated_text text,
  nep_confidence numeric,
  hallucination_index numeric,
  quality_rating numeric,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_generations" ON generations;
CREATE POLICY "select_generations" ON generations FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "insert_generations" ON generations;
CREATE POLICY "insert_generations" ON generations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_generations" ON generations;
CREATE POLICY "update_generations" ON generations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_generations" ON generations;
CREATE POLICY "delete_generations" ON generations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- quiz_forms
CREATE TABLE IF NOT EXISTS quiz_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES generations(id) ON DELETE SET NULL,
  title text NOT NULL,
  student_quiz_link text,
  professor_results_link text,
  question_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quizzes" ON quiz_forms;
CREATE POLICY "select_quizzes" ON quiz_forms FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "insert_quizzes" ON quiz_forms;
CREATE POLICY "insert_quizzes" ON quiz_forms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_quizzes" ON quiz_forms;
CREATE POLICY "update_quizzes" ON quiz_forms FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_quizzes" ON quiz_forms;
CREATE POLICY "delete_quizzes" ON quiz_forms FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- shared_materials
CREATE TABLE IF NOT EXISTS shared_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text,
  file_type text,
  subject text,
  student_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shared_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_materials" ON shared_materials;
CREATE POLICY "select_materials" ON shared_materials FOR SELECT
  TO authenticated USING (
    auth.uid() = professor_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'student')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_materials" ON shared_materials;
CREATE POLICY "insert_materials" ON shared_materials FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'professor')));

DROP POLICY IF EXISTS "update_materials" ON shared_materials;
CREATE POLICY "update_materials" ON shared_materials FOR UPDATE
  TO authenticated USING (auth.uid() = professor_id) WITH CHECK (auth.uid() = professor_id);

DROP POLICY IF EXISTS "delete_materials" ON shared_materials;
CREATE POLICY "delete_materials" ON shared_materials FOR DELETE
  TO authenticated USING (auth.uid() = professor_id);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  scheduled_for timestamptz NOT NULL,
  notification_type text DEFAULT 'milestone',
  is_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_notifications" ON notifications;
CREATE POLICY "select_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- usage_logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  time_saved_minutes numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_logs" ON usage_logs;
CREATE POLICY "select_logs" ON usage_logs FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "insert_logs" ON usage_logs;
CREATE POLICY "insert_logs" ON usage_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- indexes
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_forms_user_id ON quiz_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_materials_professor_id ON shared_materials(professor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- seed default prompt templates
INSERT INTO prompt_templates (name, template_type, system_prompt, variables) VALUES
  ('Lesson Plan Builder', 'lesson_plan', 'You are an expert educator. Create a detailed lesson plan for the following topic. Structure: Learning Objectives, Duration, Materials, Introduction, Main Activities, Assessment, Homework. Ensure alignment with NEP 2020 competency-based education principles.', '["topic","grade_level","subject","duration_minutes","language"]'::jsonb),
  ('Quiz Generator', 'quiz', 'You are an assessment expert. Generate a quiz with multiple choice and short answer questions. For each question provide: question text, options (for MCQ), correct answer, and explanation. Align with NEP 2020 holistic assessment principles.', '["topic","num_questions","difficulty","question_types","language"]'::jsonb),
  ('PPT Outline Creator', 'ppt_outline', 'You are a presentation design expert. Create a structured PowerPoint outline with slide titles, bullet points, and speaker notes. Include an agenda, content slides, and a summary. Optimize for student engagement.', '["topic","num_slides","audience","language"]'::jsonb),
  ('Word Brief Generator', 'word_brief', 'You are a technical writer. Create a concise word brief covering the topic definition, key concepts, applications, and references. Keep it under 500 words and suitable for student reference material.', '["topic","word_limit","audience","language"]'::jsonb),
  ('Research Paper Formatter', 'research_paper', 'You are an academic researcher. Structure a research paper outline with: Abstract, Introduction, Literature Review, Methodology, Results, Discussion, Conclusion, References. Follow NEP 2020 research standards.', '["topic","research_field","paper_length","language"]'::jsonb)
ON CONFLICT DO NOTHING;
