'use client';

import { useState, useEffect } from 'react';
import { AppNav } from '@/components/app-nav';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { PromptTemplate, Generation, LANGUAGES, TEMPLATE_TYPE_LABELS } from '@/lib/types';
import { withCorePromptTemplates } from '@/lib/prompt-templates';
import { FileText, Sparkles, Brain, Globe, Download, CheckCircle2, Loader2, ExternalLink, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGeneration(value: unknown): value is Generation {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.template_type === 'string' &&
    typeof value.target_language === 'string' &&
    isRecord(value.input_variables) &&
    typeof value.training_opt_in === 'boolean' &&
    typeof value.status === 'string' &&
    typeof value.created_at === 'string'
  );
}

type SourceCitation = {
  reference: string
  title: string
  document_id: string
  chunk_index: number
  similarity: number
  excerpt: string
}

function isSourceCitation(value: unknown): value is SourceCitation {
  return (
    isRecord(value) &&
    typeof value.reference === 'string' &&
    typeof value.title === 'string' &&
    typeof value.document_id === 'string' &&
    typeof value.chunk_index === 'number' &&
    typeof value.similarity === 'number' &&
    typeof value.excerpt === 'string'
  )
}

async function readJsonResponse(response: Response, failureMessage: string): Promise<unknown> {
  const responseText = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }

  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === 'string'
        ? data.error
        : `${failureMessage} (status ${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function readErrorResponse(response: Response, failureMessage: string): Promise<Error> {
  const responseText = await response.text();

  try {
    const data: unknown = JSON.parse(responseText);
    if (isRecord(data) && typeof data.error === 'string') {
      return new Error(data.error);
    }
  } catch {
    if (!responseText) {
      return new Error(`${failureMessage} (status ${response.status})`);
    }
  }

  return new Error(
    responseText || `${failureMessage} (status ${response.status})`
  );
}

export default function GeneratePage() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [language, setLanguage] = useState('English');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sourceContent, setSourceContent] = useState('');
  const [useDocuments, setUseDocuments] = useState(true);
  const [saveSource, setSaveSource] = useState(false);
  const [sources, setSources] = useState<SourceCitation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);
  const [creatingForm, setCreatingForm] = useState(false);
  const [quizLink, setQuizLink] = useState<{ student_quiz_link: string; professor_results_link: string | null } | null>(null);
  const [evaluationWarning, setEvaluationWarning] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('prompt_templates').select('*').order('name');
      if (error) toast.error(`Could not load saved templates; built-in templates remain available. ${error.message}`);
      const availableTemplates = withCorePromptTemplates((data as PromptTemplate[] | null) ?? []);
      setTemplates(availableTemplates);
      const preferred = availableTemplates.find((template) => template.template_type === 'ppt_outline') ?? availableTemplates[0];
      if (preferred) {
        setSelectedTemplate(preferred);
        const vars: Record<string, string> = {};
        preferred.variables.forEach((variable) => { vars[variable] = ''; });
        setVariables(vars);
      }
    })();
  }, []);

  function handleTemplateChange(templateId: string) {
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setSelectedTemplate(tmpl);
      const vars: Record<string, string> = {};
      (tmpl.variables as string[]).forEach((v) => { vars[v] = ''; });
      setVariables(vars);
    }
  }

  async function handleGenerate() {
    if (!profile || !selectedTemplate) return;
    setGenerating(true);
    setResult(null);
    setQuizLink(null);
    setSources([]);
    setEvaluationWarning(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch('/api/generate-and-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_type: selectedTemplate.template_type,
          system_prompt: selectedTemplate.system_prompt,
          target_language: language,
          variables,
          source_content: sourceContent || undefined,
          use_documents: useDocuments,
          save_source: saveSource,
        }),
      });

      const data = await readJsonResponse(response, 'Generation failed');
      if (!isRecord(data) || !isGeneration(data.generation)) {
        throw new Error('The server returned an invalid generation response.');
      }
      setResult(data.generation);
      setSources(Array.isArray(data.sources) ? data.sources.filter(isSourceCitation) : []);
      setEvaluationWarning(typeof data.evaluation_warning === 'string' ? data.evaluation_warning : null);
      toast.success('Content generated.');

      // Refresh generations list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateGoogleForm() {
    if (!result) return;
    setCreatingForm(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch('/api/google/forms-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ generation_id: result.id, title: `${TEMPLATE_TYPE_LABELS[result.template_type]} Quiz` }),
      });

      const data = await readJsonResponse(response, 'Failed to create form');
      if (
        !isRecord(data) ||
        typeof data.student_quiz_link !== 'string' ||
        (typeof data.professor_results_link !== 'string' && data.professor_results_link !== null)
      ) {
        throw new Error('The server returned invalid Google Form links.');
      }
      setQuizLink({
        student_quiz_link: data.student_quiz_link,
        professor_results_link: typeof data.professor_results_link === 'string' ? data.professor_results_link : null,
      });
      toast.success('Google Form created!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create form');
    } finally {
      setCreatingForm(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx' | 'pptx') {
    if (!result) return;

    try {
      const params = new URLSearchParams({
        generation_id: result.id,
        format,
      });
      const response = await fetch(`/api/export?${params.toString()}`);
      if (!response.ok) {
        throw await readErrorResponse(response, 'Export failed');
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `generation-${result.id}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  }

  return (
    <AppNav>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Content</h1>
          <p className="mt-1 text-muted-foreground">Generate content grounded in your source documents, with passages cited for review.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Template Selection</CardTitle>
                <CardDescription>Choose a prompt template for your content type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select onValueChange={handleTemplateChange} value={selectedTemplate?.id}>
                    <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                    <SelectContent>
                      {(templates || []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(LANGUAGES || []).map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {selectedTemplate && (selectedTemplate.variables as string[]).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Template Variables</CardTitle>
                  <CardDescription>Fill in the dynamic fields for this template</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {((selectedTemplate.variables as string[]) || []).map((v) => (
                    <div key={v} className="space-y-2">
                      <Label className="capitalize">{v.replace(/_/g, ' ')}</Label>
                      <Input
                        value={variables[v] || ''}
                        onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                        placeholder={`Enter ${v.replace(/_/g, ' ')}`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Reference Sources</CardTitle>
                <CardDescription>Retrieve relevant passages from your uploaded library and optionally add pasted reference text.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="use-documents">Use my uploaded source library</Label>
                  <p className="text-xs text-muted-foreground">Semantic search selects the passages most relevant to your topic.</p>
                </div>
                <Switch id="use-documents" checked={useDocuments} onCheckedChange={setUseDocuments} />
              </div>
              <Textarea
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                placeholder="Paste reference material, textbook excerpts, or any source text..."
                className="min-h-[120px]"
              />
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="save-source">Save pasted source with this generation</Label>
                  <p className="text-xs text-muted-foreground">When off, pasted text is only used for this request and is not saved in its record.</p>
                </div>
                <Switch id="save-source" checked={saveSource} onCheckedChange={setSaveSource} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Pasted text is sent to OpenAI for this request. Check your provider account’s data-retention settings.</p>
              </div>
              </CardContent>
            </Card>

            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2" size="lg">
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating & Verifying...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Grounded Content</>
              )}
            </Button>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {generating && (
              <Card className="border-primary/20">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
                  <p className="font-medium">Generating content...</p>
                  <p className="text-sm text-muted-foreground">Searching sources and preparing a cited response</p>
                </CardContent>
              </Card>
            )}

            {!generating && !result && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Brain className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Your generated content will appear here</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <Card className="border-accent/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-accent" /> Retrieved Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sources.length ? sources.map((source) => (
                      <div key={`${source.document_id}-${source.chunk_index}`} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">[{source.reference}] {source.title} · passage {source.chunk_index + 1}</p>
                          <Badge variant="outline">{Math.round(source.similarity * 100)}% match</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{source.excerpt}{source.excerpt.length >= 360 ? '…' : ''}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">
                        {useDocuments || sourceContent.trim()
                          ? 'No sufficiently relevant source passages were found. Review the response carefully before using it.'
                          : 'No source documents were selected. This response is not grounded in your course materials.'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Similarity is a retrieval signal, not a fact-check or accuracy score. Review citations against the original material.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>AI rubric estimates</CardTitle>
                    <CardDescription>Guidance only — not an official NEP assessment or independent fact-check.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {evaluationWarning ? (
                      <p role="status" className="text-sm text-amber-700">{evaluationWarning}</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border p-3">
                          <p className="text-sm text-muted-foreground">NEP 2020 alignment</p>
                          <p className="text-xl font-semibold">{result.nep_confidence != null ? `${result.nep_confidence.toFixed(0)}/100` : 'Not evaluated'}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-sm text-muted-foreground">Evidence risk (higher is riskier)</p>
                          <p className="text-xl font-semibold">{result.hallucination_index != null ? `${Math.round(result.hallucination_index * 100)}%` : 'No source-based estimate'}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-sm text-muted-foreground">Content quality</p>
                          <p className="text-xl font-semibold">{result.quality_rating != null ? `${result.quality_rating.toFixed(0)}/10` : 'Not evaluated'}</p>
                        </div>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">These scores are model-generated estimates. Verify important claims and citations against primary sources.</p>
                  </CardContent>
                </Card>

                {/* Generated Content */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Generated Content</CardTitle>
                      <Badge>{language}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed">
                      {result.generated_text}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  {result.template_type === 'quiz' && (
                    <Button onClick={handleCreateGoogleForm} disabled={creatingForm} className="gap-2">
                      {creatingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Create Google Form
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => handleExport('pdf')} className="gap-2">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('docx')} className="gap-2">
                    <Download className="h-4 w-4" /> DOCX
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('pptx')} className="gap-2">
                    <Download className="h-4 w-4" /> PPTX
                  </Button>
                </div>

                {quizLink && (
                  <Card className="border-accent/20 bg-accent/5">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-accent" />
                        <p className="font-semibold text-accent">Google Form Created Successfully</p>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Student Quiz Link</Label>
                          <a href={quizLink.student_quiz_link} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline break-all">
                            {quizLink.student_quiz_link}
                          </a>
                        </div>
                        <div>
                          <Label className="text-xs">Professor Results Link</Label>
                          {quizLink.professor_results_link ? (
                            <a href={quizLink.professor_results_link} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline break-all">
                              {quizLink.professor_results_link}
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">The publishing service did not return an editor link.</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppNav>
  );
}
