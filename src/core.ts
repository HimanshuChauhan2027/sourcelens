import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Brief, Evidence, Source, Validation, Version } from './types.ts';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export function date(value: unknown, name = 'date'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} is not a valid calendar date.`);
  }
  return value;
}

export function ticker(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z0-9][A-Z0-9&_.-]{0,29}$/.test(value)) {
    throw new Error('Ticker must be 1–30 uppercase ticker characters.');
  }
  return value;
}

export function parseSource(raw: string, filename: string, id: string, asOf: string): Source {
  const normalised = raw.replace(/\r\n/g, '\n');
  const match = normalised.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing YAML-style source header.`);
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (entry) {
      if (Object.hasOwn(meta, entry[1])) throw new Error(`${filename}: duplicate header field ${entry[1]}.`);
      meta[entry[1]] = entry[2];
    }
  }
  for (const field of ['source', 'url', 'published', 'type']) {
    if (!meta[field]) throw new Error(`${filename}: missing ${field} header.`);
  }
  date(meta.published, `${filename} publication date`);
  let url: URL;
  try { url = new URL(meta.url); } catch { throw new Error(`${filename}: invalid source URL.`); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${filename}: source URL must be an HTTP(S) URL without credentials.`);
  }
  if (!match[2].trim()) throw new Error(`${filename}: empty source body.`);
  return {
    id, filename, source: meta.source, url: meta.url, published: meta.published,
    type: meta.type, body: match[2], raw, sha256: sha256(raw), eligible: meta.published <= asOf,
  };
}

export async function loadSources(directory: string, asOf: string): Promise<Source[]> {
  date(asOf, 'Research date');
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.filter(entry => entry.isFile() && /\.md$/i.test(entry.name)
    && !/^readme(?:\.|$)/i.test(entry.name) && !entry.name.startsWith('.')).map(entry => entry.name).sort();
  if (names.length === 0) throw new Error('No Markdown source files found.');
  if (names.length > 100) throw new Error('This small-document agent accepts at most 100 source files.');
  let totalBytes = 0;
  const sources: Source[] = [];
  for (const [index, name] of names.entries()) {
    const raw = await readFile(join(directory, name), 'utf8');
    const size = Buffer.byteLength(raw);
    if (size > 512_000) throw new Error(`${name}: exceeds the 512 KB per-document limit.`);
    totalBytes += size;
    if (totalBytes > 5_000_000) throw new Error('Document set exceeds the 5 MB limit.');
    sources.push(parseSource(raw, name, `S${String(index + 1).padStart(2, '0')}`, asOf));
  }
  if (!sources.some(source => source.eligible)) throw new Error('Every source is after the research date.');
  return sources;
}

const obj = (value: unknown, label: string): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, any>;
};
const str = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string.`);
  return value;
};
const arr = (value: unknown, label: string): any[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
};
const unique = (values: string[], label: string) => {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicates.`);
};
function exactKeys(value: Record<string, any>, allowed: string[], label: string) {
  if (Object.keys(value).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(value, key))) {
    throw new Error(`${label} must have exactly these fields: ${allowed.join(', ')}.`);
  }
}

function header(value: Record<string, any>, expectedTicker: string, asOf: string) {
  if (value.ticker !== expectedTicker) throw new Error('Response ticker does not match the requested company.');
  if (value.as_of !== asOf) throw new Error('Response research date does not match the request.');
}

export function validateEvidence(value: unknown, sources: Source[], expectedTicker: string, asOf: string, version: Version): Evidence {
  const evidence = obj(value, 'Evidence');
  exactKeys(evidence, ['ticker', 'as_of', 'document_decisions', 'claims', 'conflicts', 'uncertainties'], 'Evidence');
  header(evidence, expectedTicker, asOf);
  const eligible = new Map(sources.filter(source => source.eligible).map(source => [source.id, source]));
  const refList = (value: unknown, label: string, nonempty = true): string[] => {
    const ids = arr(value, label).map((id, index) => str(id, `${label}[${index}]`));
    unique(ids, label);
    if (nonempty && ids.length === 0) throw new Error(`${label} needs a supporting source.`);
    for (const id of ids) if (!eligible.has(id)) throw new Error(`${label}: unknown or future source ${id}.`);
    return ids;
  };
  const decisions = arr(evidence.document_decisions, 'document_decisions');
  const decisionMap = new Map<string, any>();
  for (const item of decisions) {
    const d = obj(item, 'Document decision');
    exactKeys(d, ['source_id', 'disposition', 'entity_match', 'reason'], 'Document decision');
    const id = str(d.source_id, 'source_id');
    if (!eligible.has(id)) throw new Error(`Document decision has unknown or future source ${id}.`);
    if (decisionMap.has(id)) throw new Error(`Duplicate document decision for ${id}.`);
    if (!['use', 'context', 'exclude'].includes(d.disposition)) throw new Error(`Invalid disposition for ${id}.`);
    if (typeof d.entity_match !== 'boolean' && d.entity_match !== 'uncertain') throw new Error(`Invalid entity_match for ${id}.`);
    if (d.entity_match === false && d.disposition !== 'exclude') throw new Error(`Wrong-entity source ${id} must be excluded.`);
    str(d.reason, `${id} decision reason`);
    decisionMap.set(id, d);
  }
  if (decisionMap.size !== eligible.size) throw new Error('Every eligible document needs exactly one relevance decision.');
  const claims = arr(evidence.claims, 'claims');
  if (claims.length === 0) throw new Error('Evidence needs at least one supported claim.');
  const claimIds: string[] = [];
  for (const item of claims) {
    const c = obj(item, 'Claim');
    exactKeys(c, ['id', 'text', 'source_ids', 'support', 'period', 'kind'], 'Claim');
    const id = str(c.id, 'claim id');
    if (!/^C\d{2,}$/.test(id)) throw new Error(`Claim id ${id} must look like C01.`);
    claimIds.push(id);
    str(c.text, `${id} text`);
    str(c.period, `${id} period`);
    if (!['reported_fact', 'management_expectation', 'inference'].includes(c.kind)) throw new Error(`${id}: invalid claim kind.`);
    const ids = refList(c.source_ids, `${id} source_ids`);
    for (const sourceId of ids) {
      const decision = decisionMap.get(sourceId);
      if (decision.disposition === 'exclude' || decision.entity_match !== true) {
        throw new Error(`${id}: cannot assert a claim from excluded or unconfirmed-entity source ${sourceId}.`);
      }
    }
    const support = arr(c.support, `${id} support`);
    const quotedIds = new Set<string>();
    for (const item of support) {
      const s = obj(item, `${id} support item`);
      exactKeys(s, ['source_id', 'quote'], `${id} support item`);
      if (!ids.includes(s.source_id)) throw new Error(`${id}: quote source must appear in source_ids.`);
      const quote = str(s.quote, `${id} quote`);
      if (version === 'v3' && !eligible.get(s.source_id)!.body.includes(quote)) {
        throw new Error(`${id}: supporting quote is not an exact excerpt of ${s.source_id}.`);
      }
      quotedIds.add(s.source_id);
    }
    if (ids.some(id => !quotedIds.has(id))) throw new Error(`${id}: each supporting source needs a quote.`);
  }
  unique(claimIds, 'claim ids');
  const conflictIds: string[] = [];
  for (const item of arr(evidence.conflicts, 'conflicts')) {
    const c = obj(item, 'Conflict');
    exactKeys(c, ['id', 'claim', 'source_ids', 'resolution', 'preferred_source_ids'], 'Conflict');
    const id = str(c.id, 'conflict id');
    if (!/^X\d{2,}$/.test(id)) throw new Error('Conflict ids must look like X01.');
    conflictIds.push(id);
    str(c.claim, `${id} claim`);
    str(c.resolution, `${id} resolution`);
    const ids = refList(c.source_ids, `${id} source_ids`);
    const preferred = refList(c.preferred_source_ids, `${id} preferred_source_ids`, false);
    if (preferred.some(id => !ids.includes(id))) throw new Error(`${id}: preferred source must be one of the competing sources.`);
    if (preferred.some(id => decisionMap.get(id).disposition === 'exclude')) throw new Error(`${id}: preferred source cannot be excluded.`);
  }
  unique(conflictIds, 'conflict ids');
  for (const item of arr(evidence.uncertainties, 'uncertainties')) {
    const q = obj(item, 'Uncertainty');
    exactKeys(q, ['question', 'source_ids'], 'Uncertainty');
    str(q.question, 'uncertainty question');
    refList(q.source_ids, 'uncertainty source_ids', false);
  }
  return evidence as Evidence;
}

export function validateBrief(value: unknown, sources: Source[], expectedTicker: string, asOf: string, version: Version, evidence?: Evidence): { brief: Brief; validation: Validation } {
  const brief = obj(value, 'Brief');
  exactKeys(brief, ['ticker', 'as_of', 'brief_markdown'], 'Brief');
  header(brief, expectedTicker, asOf);
  const markdown = str(brief.brief_markdown, 'brief_markdown');
  if (/<(?:script|iframe|style|img|svg|object|embed)\b/i.test(markdown)) throw new Error('Brief must be Markdown text, without embedded active HTML.');
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map(match => match[1]);
  const required = ['Snapshot', 'Bull case', 'Bear case', 'Open questions', 'Sources'];
  if (JSON.stringify(headings) !== JSON.stringify(required)) throw new Error('Brief must have exactly the five required ## sections in the correct order.');
  const split = markdown.split(/^## Sources\s*$/m);
  const body = split[0];
  const sourceSection = split[1] ?? '';
  const eligible = new Map(sources.filter(source => source.eligible).map(source => [source.id, source]));
  const refs = (text: string) => [...text.matchAll(/\[(S\d{2,})\]/g)].map(match => match[1]);
  const cited = new Set(refs(body));
  if (cited.size === 0) throw new Error('Brief contains no source citations. Use [S01] notation.');
  for (const id of refs(markdown)) {
    if (!eligible.has(id)) throw new Error(`Brief cites unknown or future source ${id}.`);
  }
  const listed = refs(sourceSection);
  unique(listed, 'Sources registry');
  for (const id of cited) if (!listed.includes(id)) throw new Error(`Sources registry is missing cited source ${id}.`);
  for (const id of listed) if (!cited.has(id)) throw new Error(`Sources registry contains uncited source ${id}.`);
  if (evidence) {
    const excluded = new Set(evidence.document_decisions.filter(d => d.disposition === 'exclude').map(d => d.source_id));
    for (const id of cited) if (excluded.has(id)) throw new Error(`Brief cites excluded source ${id}.`);
  }
  const warnings: string[] = [];
  const checks = ['Response schema and ticker/date match', 'Five required sections in order', 'All citations reference eligible inputs', 'Sources registry matches body citations'];
  if (evidence) checks.push('Brief does not cite an excluded document');
  const wordCount = markdown.trim().split(/\s+/).length;
  if (wordCount < 250 || wordCount > 620) warnings.push(`Brief is ${wordCount} words; target about one page (roughly 350–550 words).`);
  if (version === 'v3') {
    const sections = body.split(/^##\s+/m).slice(1);
    for (const section of sections) {
      const [heading, ...lines] = section.split('\n');
      const content = lines.filter(line => line.trim() && !line.startsWith('#'));
      if (heading.trim() === 'Snapshot' && (content.length < 3 || content.length > 4)) {
        throw new Error('Snapshot must contain 3–4 nonempty prose lines.');
      }
      for (const line of content) {
        if (refs(line).length === 0 && !/^(?:- )?Not supplied in the pack:/i.test(line.trim())) {
          throw new Error(`Uncited content line under ${heading.trim()}. Missing-data questions may begin "Not supplied in the pack:".`);
        }
      }
    }
    for (const id of listed) {
      const line = sourceSection.split('\n').find(line => line.includes(`[${id}]`)) ?? '';
      const source = eligible.get(id)!;
      if (!line.includes(source.filename) || !line.includes(source.published) || !line.includes(source.url)) {
        throw new Error(`${id}: source entry must retain the exact filename, publication date and supplied URL.`);
      }
    }
    checks.push('Snapshot has 3–4 prose lines', 'Content lines contain citations or explicit missing-data labels', 'Source filenames, dates and supplied URLs retained', 'Accepted evidence quotations match input text exactly');
  }
  return {
    brief: brief as Brief,
    validation: {
      status: 'passed', checks, warnings, word_count: wordCount,
      limitation: 'Mechanical checks verify structure, references and, in v3, quote provenance. They do not establish source authenticity, prove semantic entailment, or guarantee prompt-injection resistance. Human review is still needed.',
    },
  };
}
