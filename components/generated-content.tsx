'use client';

import { useEffect, useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImageIcon } from 'lucide-react';
import { cleanMathMarkup, splitGeneratedContent } from '@/lib/content-segments';

export { splitGeneratedContent };

type StockImage = { url: string; title: string; author: string; license: string; sourceUrl: string };

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;
let renderCounter = 0;

function loadMermaid() {
  mermaidReady ??= import('mermaid').then(({ default: mermaid }) => {
    // Plain SVG text (no HTML labels) so diagrams can also be rasterized for downloads.
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', htmlLabels: false, flowchart: { htmlLabels: false } });
    return mermaid;
  });
  return mermaidReady;
}

export async function renderMermaidSvg(code: string) {
  const mermaid = await loadMermaid();
  renderCounter += 1;
  const { svg } = await mermaid.render(`mermaid-render-${renderCounter}`, code);
  return svg;
}

// Rasterizes a Mermaid diagram to a PNG data URL for DOCX, PDF, and PPTX downloads.
export async function renderMermaidPng(code: string, scale = 2): Promise<string | null> {
  try {
    const svg = await renderMermaidSvg(code);
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    const viewBox = parsed.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    const width = Math.ceil(viewBox?.[2] || Number.parseFloat(parsed.getAttribute('width') ?? '') || 800);
    const height = Math.ceil(viewBox?.[3] || Number.parseFloat(parsed.getAttribute('height') ?? '') || 600);
    parsed.setAttribute('width', String(width));
    parsed.setAttribute('height', String(height));
    const source = new XMLSerializer().serializeToString(parsed);
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Diagram image failed to load.')); });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(width * scale, 4000);
    canvas.height = Math.min(height * scale, 4000);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function MermaidDiagram({ code }: { code: string }) {
  const id = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderMermaidSvg(code)
      .then((rendered) => { if (!cancelled) setSvg(rendered); })
      .catch(() => { if (!cancelled) setFailed(true); });
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
  const [image, setImage] = useState<StockImage | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/images/search?q=${encodeURIComponent(query)}`)
      .then((response) => (response.ok ? response.json() : { image: null }))
      .then((payload: { image: StockImage | null }) => { if (!cancelled) setImage(payload.image); })
      .catch(() => { if (!cancelled) setImage(null); });
    return () => { cancelled = true; };
  }, [query]);

  if (image) {
    return (
      <figure data-testid="slide-image" className="my-3 overflow-hidden rounded-lg border bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={query} loading="lazy" className="max-h-80 w-full object-contain" />
        <figcaption className="px-3 py-1.5 text-xs text-muted-foreground">
          {query} · <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{image.author}, {image.license}</a>
        </figcaption>
      </figure>
    );
  }
  return (
    <figure data-testid="image-placeholder" className="my-3 flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
      <ImageIcon className="h-5 w-5 shrink-0 text-primary" />
      <figcaption><span className="font-medium">{image === undefined ? 'Finding image:' : 'Image placement:'}</span> {query}</figcaption>
    </figure>
  );
}

export function GeneratedContent({ text }: { text: string }) {
  return (
    <div data-testid="generated-content" className="text-sm leading-relaxed [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:bg-primary/5 [&_blockquote]:px-3 [&_blockquote]:py-1 [&_code]:font-mono [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:bg-muted [&_th]:p-1.5">
      {splitGeneratedContent(text).map((segment, index) => {
        if (segment.kind === 'mermaid') return <MermaidDiagram key={index} code={segment.value} />;
        if (segment.kind === 'image') return <ImageHook key={index} query={segment.value} />;
        return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{cleanMathMarkup(segment.value)}</ReactMarkdown>;
      })}
    </div>
  );
}
