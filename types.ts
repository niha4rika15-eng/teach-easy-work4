export type Role = 'admin' | 'professor' | 'student';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  institution?: string;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template_type: string;
  system_prompt: string;
  variables: string[];
  created_by?: string;
  created_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  template_type: string;
  title?: string;
  target_language: string;
  input_variables: Record<string, string>;
  source_content?: string;
  training_opt_in: boolean;
  generated_text?: string;
  nep_confidence?: number;
  hallucination_index?: number;
  quality_rating?: number;
  status: string;
  created_at: string;
}

export interface QuizForm {
  id: string;
  user_id: string;
  generation_id?: string;
  title: string;
  student_quiz_link?: string;
  professor_results_link?: string;
  question_count: number;
  created_at: string;
}

export interface SharedMaterial {
  id: string;
  professor_id: string;
  title: string;
  description?: string;
  file_url?: string;
  file_type?: string;
  subject?: string;
  student_ids: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  scheduled_for: string;
  notification_type: string;
  is_sent: boolean;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id?: string;
  event_type: string;
  event_data: Record<string, unknown>;
  time_saved_minutes: number;
  created_at: string;
}

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  lesson_plan: 'Lesson Plan',
  quiz: 'Quiz',
  ppt_outline: 'PPT Outline',
  word_brief: 'Word Brief',
  research_paper: 'Research Paper',
};

export const LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Bengali', label: 'Bengali' },
  { value: 'Marathi', label: 'Marathi' },
  { value: 'Telugu', label: 'Telugu' },
];
