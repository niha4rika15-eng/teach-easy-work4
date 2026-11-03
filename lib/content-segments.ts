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

const SUBSCRIPTS: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋' };
const SUPERSCRIPTS: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const LATEX_SYMBOLS: Record<string, string> = { rightarrow: '→', to: '→', leftarrow: '←', leftrightarrow: '↔', rightleftharpoons: '⇌', times: '×', cdot: '·', pm: '±', approx: '≈', leq: '≤', geq: '≥', neq: '≠', degree: '°', Delta: 'Δ', delta: 'δ', alpha: 'α', beta: 'β', gamma: 'γ', lambda: 'λ', mu: 'μ', pi: 'π' };

const mapChars = (value: string, table: Record<string, string>) => Array.from(value).map((char) => table[char] ?? char).join('');

// Turns simple LaTeX the model may emit ($CO_2$, \rightarrow, \text{...}) into readable Unicode.
export function cleanMathMarkup(text: string) {
  const convert = (math: string) => math
    .replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)/g, (match, name: string) => LATEX_SYMBOLS[name] ?? match)
    .replace(/_\{([0-9+-]+)\}|_([0-9+-])/g, (_, group: string | undefined, single: string | undefined) => mapChars(group ?? single ?? '', SUBSCRIPTS))
    .replace(/\^\{([0-9+-]+)\}|\^([0-9+-])/g, (_, group: string | undefined, single: string | undefined) => mapChars(group ?? single ?? '', SUPERSCRIPTS))
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ');
  return text.replace(/\$\$([^$]+)\$\$|\$([^$\n]{1,200})\$/g, (match, block: string | undefined, inline: string | undefined) => (block !== undefined || /[_^\\]/.test(inline ?? '') ? convert(block ?? inline ?? '') : match));
}

// Readable text version of a Mermaid diagram, used when it cannot be embedded as a picture.
export function mermaidToText(code: string) {
  const labels = new Map<string, string>();
  for (const match of Array.from(code.matchAll(/([A-Za-z0-9_]+)\s*[[({]+"?([^\])}"]+)"?[\])}]+/g))) labels.set(match[1], match[2].trim());
  const label = (id: string) => labels.get(id) ?? id;
  const edges = Array.from(code.matchAll(/([A-Za-z0-9_]+)(?:\s*[[({]+[^\])}]*[\])}]+)?\s*(?:-->|---|==>|-\.->|--\s*[^-]+\s*-->)\s*(?:\|"?([^|"]*)"?\|\s*)?([A-Za-z0-9_]+)/g));
  if (!edges.length) return Array.from(labels.values()).join(' • ');
  return edges.map((edge) => `${label(edge[1])} → ${edge[2] ? `(${edge[2].trim()}) ` : ''}${label(edge[3])}`).join('\n');
}
