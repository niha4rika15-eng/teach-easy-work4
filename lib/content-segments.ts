export type Segment = { kind: 'markdown' | 'mermaid' | 'image'; value: string };

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

export function extractMermaidBlocks(text: string) {
  return splitGeneratedContent(text).filter((segment) => segment.kind === 'mermaid').map((segment) => segment.value);
}

export function extractImageQueries(text: string) {
  return Array.from(new Set(splitGeneratedContent(text).filter((segment) => segment.kind === 'image').map((segment) => segment.value)));
}

export type Script = 'latin' | 'devanagari' | 'bengali' | 'telugu';

function scriptOf(character: string): Script | null {
  const code = character.codePointAt(0)!;
  if (code >= 0x0900 && code <= 0x097f) return 'devanagari';
  if (code >= 0x0980 && code <= 0x09ff) return 'bengali';
  if (code >= 0x0c00 && code <= 0x0c7f) return 'telugu';
  if (/\s/.test(character)) return null;
  return 'latin';
}

// Groups text into runs of one script so each run can use a font that has its glyphs.
export function splitScriptRuns(text: string): Array<{ script: Script; text: string }> {
  const runs: Array<{ script: Script; text: string }> = [];
  for (const character of Array.from(text)) {
    const script = scriptOf(character) ?? runs[runs.length - 1]?.script ?? 'latin';
    const current = runs[runs.length - 1];
    if (current && current.script === script) current.text += character;
    else runs.push({ script, text: character });
  }
  return runs;
}

export function hasIndicScript(text: string) {
  return /[\u0900-\u09ff\u0c00-\u0c7f]/.test(text);
}

export function stripInlineMarkdown(value: string) {
  return value.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[(.+?)\]\((.+?)\)/g, '$1').trim();
}
