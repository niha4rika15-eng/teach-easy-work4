'use client';

import { useEffect, useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImageIcon } from 'lucide-react';

type Segment = { kind: 'markdown' | 'mermaid' | 'image'; value: string };

// Splits generated text into Markdown, ```mermaid diagrams, and [IMAGE: query] placement hooks.
export function splitGeneratedContent(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /```mermaid\s*\n([\s\S]*?)```|\[IMAGE:\s*([^\]]+)\]/g;
  let last = 0;
  for (const match of Array.from(text.matchAll(pattern))) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'markdown', value: text.slice(last, start) });
    segments.push(match[1] !== undefined ? { kind: 'mermaid', value: match[1].trim() } : { kind: 'image', value: match[2].trim() });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'markdown', value: text.slice(last) });
  return segments.filter((segment) => segment.value.trim());
}

function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
        const { svg: rendered } = await mermaid.render(`mermaid-${id}`, code);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, id]);

  if (failed || !svg) {
    return (
      <pre data-testid="mermaid-source" className="overflow-x-auto rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
        {failed ? `Diagram could not be rendered; Mermaid source:\n${code}` : code}
      </pre>
    );
  }
  return <div data-testid="mermaid-diagram" className="my-3 overflow-x-auto rounded-lg border bg-background p-3" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ImageHook({ query }: { query: string }) {
  return (
    <figure data-testid="image-placeholder" className="my-3 flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
      <ImageIcon className="h-5 w-5 shrink-0 text-primary" />
      <figcaption><span className="font-medium">Image placement:</span> {query}</figcaption>
    </figure>
  );
}

export function GeneratedContent({ text }: { text: string }) {
  return (
    <div data-testid="generated-content" lang="mul" className="text-sm leading-relaxed [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:bg-primary/5 [&_blockquote]:px-3 [&_blockquote]:py-1 [&_code]:font-mono [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:bg-muted [&_th]:p-1.5 [&_pre]:whitespace-pre [&_pre]:overflow-x-auto">
      {splitGeneratedContent(text).map((segment, index) => {
        if (segment.kind === 'mermaid') return <MermaidDiagram key={index} code={segment.value} />;
        if (segment.kind === 'image') return <ImageHook key={index} query={segment.value} />;
        return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{segment.value}</ReactMarkdown>;
      })}
    </div>
  );
}
