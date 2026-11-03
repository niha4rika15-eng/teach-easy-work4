'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { PromptTemplate, TEMPLATE_TYPE_LABELS } from '@/lib/types';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { withCorePromptTemplates } from '@/lib/prompt-templates';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('prompt_templates').select('*').order('name');
      if (error) toast.error(`Could not load saved templates; built-in templates remain available. ${error.message}`);
      setTemplates(withCorePromptTemplates((data as PromptTemplate[] | null) ?? []));
    })();
  }, []);

  return (
    <AppNav>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompt Templates</h1>
          <p className="mt-1 text-muted-foreground">Standard system prompt templates for each content type</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {(templates || []).map((tmpl) => (
            <Card key={tmpl.id} className="border-border/60 transition-all hover:shadow-lg animate-scale-in">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <CardTitle>{tmpl.name}</CardTitle>
                  </div>
                  <Badge>{TEMPLATE_TYPE_LABELS[tmpl.template_type] ?? tmpl.template_type}</Badge>
                </div>
                <CardDescription className="mt-2">{tmpl.system_prompt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {((tmpl.variables as string[]) || []).map((v) => (
                    <span key={v} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                      {v.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppNav>
  );
}
