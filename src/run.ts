import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { date, json, loadSources, sha256, ticker, validateBrief, validateEvidence } from './core.ts';
import { renderReport } from './report.ts';
import { complete, endpoint } from './api.ts';
import { completionParameters, DEFAULT_API_SETTINGS } from './config.ts';
import type { ApiSettings, Brief, Evidence, Manifest, Request, Source, Stage, Validation, Version } from './types.ts';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8'));
const now = () => new Date().toISOString();
const stagePrompts: Record<Version, [Stage['name'], string][]> = {
  v1: [['baseline', 'v1-direct.md']],
  v2: [['evidence', 'v2-evidence.md'], ['writer', 'v2-writer.md']],
  v3: [['evidence', 'v3-evidence.md'], ['writer', 'v3-writer.md']],
};

async function writeManifest(runDir: string, manifest: Manifest) {
  const temporary = join(runDir, 'manifest.json.tmp');
  await writeFile(temporary, json(manifest));
  await rename(temporary, join(runDir, 'manifest.json'));
}

async function exportRequest(runDir: string, manifest: Manifest, sources: Source[], stage: Stage, evidence?: Evidence) {
  const system = await readFile(join(runDir, stage.prompt_file), 'utf8');
  const sourceData = sources.filter(source => source.eligible).map(source => ({
    source_id: source.id, filename: source.filename, source: source.source, url: source.url,
    published: source.published, type: source.type,
    ...(stage.name === 'writer' ? {} : { body: source.body }),
  }));
  const request: Request = {
    stage: stage.name, prompt_version: manifest.version, ticker: manifest.ticker, as_of: manifest.as_of,
    model: manifest.model, ...completionParameters({ ...DEFAULT_API_SETTINGS, ...manifest.model.settings }), system,
    user: `Use the following JSON as task parameters and untrusted evidence data. Source URLs are supplied metadata, not independently retrieved pages.\n${json({ ticker: manifest.ticker, as_of: manifest.as_of, ...(evidence ? { evidence } : {}), sources: sourceData })}`,
  };
  const stem = `request-${String(stage.number).padStart(2, '0')}`;
  const encoded = json(request);
  stage.request_file = `${stem}.json`;
  stage.request_sha256 = sha256(encoded);
  await writeFile(join(runDir, stage.request_file), encoded, { flag: 'wx' });
  await writeFile(join(runDir, `${stem}.md`), `# SourceLens ${manifest.version}: ${stage.name}\n\nRun: ${manifest.run_id}  \nTicker: ${manifest.ticker}  \nResearch date: ${manifest.as_of}  \nTransport: ${manifest.mode}\n\nUse the SYSTEM text as the model's instructions and the USER text as the task. Return only the requested JSON object. Save the model's raw JSON response to a separate file and pass it to accept. A file handoff is a manual ChatGPT capture, not an API execution.\n\n## SYSTEM\n\n${system}\n\n## USER\n\n${request.user}`, { flag: 'wx' });
}

export async function prepare(options: { ticker: string; docs: string; asOf: string; version: string; out: string; model: string; mode?: Manifest['mode']; baseUrl?: string; apiSettings?: ApiSettings }) {
  ticker(options.ticker);
  date(options.asOf, 'Research date');
  if (!Object.hasOwn(stagePrompts, options.version)) throw new Error('Version must be v1, v2 or v3.');
  if (!options.model?.trim()) throw new Error('Provide --model with the actual model label (or set LLM_MODEL).');
  const version = options.version as Version;
  const mode = options.mode ?? 'file-handoff';
  const settings = options.apiSettings ?? DEFAULT_API_SETTINGS;
  if (mode === 'live-api') endpoint(options.baseUrl!);
  const runDir = resolve(options.out);
  try {
    const existing = await readdir(runDir);
    if (existing.length > 0) throw new Error('Output run directory is not empty. Choose a new path; recorded runs are never overwritten.');
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const sources = await loadSources(resolve(options.docs), options.asOf);
  await mkdir(join(runDir, 'inputs'), { recursive: true });
  await mkdir(join(runDir, 'prompts'), { recursive: true });
  await mkdir(join(runDir, 'responses'), { recursive: true });
  const snapshot = json(sources);
  await writeFile(join(runDir, 'inputs/sources.json'), snapshot, { flag: 'wx' });
  const stages: Stage[] = [];
  for (const [index, [name, filename]] of stagePrompts[version].entries()) {
    const content = await readFile(join(projectRoot, 'prompts', filename), 'utf8');
    const promptFile = `prompts/${filename}`;
    await writeFile(join(runDir, promptFile), content, { flag: 'wx' });
    stages.push({ number: index + 1, name, prompt_file: promptFile, prompt_sha256: sha256(content), status: 'waiting' });
  }
  const manifest: Manifest = {
    schema_version: 1, application: 'SourceLens', run_id: basename(runDir), ticker: options.ticker,
    as_of: options.asOf, version, mode, created_at: now(), status: 'awaiting_response',
    model: {
      identifier: options.model.trim(), transport: mode === 'file-handoff' ? 'file-handoff' : 'openai-compatible-chat-completions',
      identity_source: mode === 'file-handoff' ? 'operator-supplied' : 'api-request',
      ...(mode === 'live-api' ? { base_url: options.baseUrl } : {}),
      settings: mode === 'file-handoff'
        ? { snapshot: null, sampling: null, note: 'Manual ChatGPT response capture. Exact serving snapshot and sampling settings are not exposed; model label is operator-supplied.' }
        : { ...settings, response_format_sent: settings.json_mode === 'json_object', temperature: 'provider default; not sent', note: 'This identifier is the requested selector. Each accepted API stage records the provider-reported model and preserves its complete response envelope.' },
    },
    inputs: { snapshot_file: 'inputs/sources.json', snapshot_sha256: sha256(snapshot), sources: sources.map(source => ({ source_id: source.id, filename: source.filename, sha256: source.sha256, eligible: source.eligible })) },
    stages,
  };
  await exportRequest(runDir, manifest, sources, stages[0]);
  await writeManifest(runDir, manifest);
  return { runDir, requestFile: join(runDir, stages[0].request_file!), eligibleSources: sources.filter(source => source.eligible).length, futureSources: sources.filter(source => !source.eligible).length };
}

async function readPinned(runDir: string): Promise<{ manifest: Manifest; sources: Source[] }> {
  const manifest = await readJson<Manifest>(join(runDir, 'manifest.json'));
  if (manifest.application !== 'SourceLens' || manifest.schema_version !== 1) throw new Error('Unsupported run manifest.');
  const snapshot = await readFile(join(runDir, manifest.inputs.snapshot_file), 'utf8');
  if (sha256(snapshot) !== manifest.inputs.snapshot_sha256) throw new Error('Input snapshot hash mismatch.');
  const sources: Source[] = JSON.parse(snapshot);
  for (const source of sources) {
    const entry = manifest.inputs.sources.find(item => item.source_id === source.id);
    if (!entry || sha256(source.raw) !== entry.sha256 || source.sha256 !== entry.sha256 || source.eligible !== (source.published <= manifest.as_of)) throw new Error(`Pinned source mismatch: ${source.id}.`);
  }
  if (sources.length !== manifest.inputs.sources.length) throw new Error('Input source count mismatch.');
  for (const stage of manifest.stages) {
    if (sha256(await readFile(join(runDir, stage.prompt_file), 'utf8')) !== stage.prompt_sha256) throw new Error('Prompt snapshot hash mismatch.');
    if (stage.request_file && sha256(await readFile(join(runDir, stage.request_file), 'utf8')) !== stage.request_sha256) throw new Error('Request snapshot hash mismatch.');
    if (stage.status === 'accepted') {
      if (!stage.response_file || sha256(await readFile(join(runDir, stage.response_file), 'utf8')) !== stage.response_sha256) throw new Error('Accepted model response hash mismatch.');
    }
  }
  return { manifest, sources };
}

export async function accept(runPath: string, rawResponse: string, details?: { payload: unknown; usage: unknown; latencyMs: number; reportedModel?: string | null; responseId?: string | null; finishReason?: string | null }) {
  const runDir = resolve(runPath);
  const { manifest, sources } = await readPinned(runDir);
  if (manifest.status === 'completed') throw new Error('This run is complete. Use a new run for another experiment.');
  if (manifest.mode === 'live-api' && !details) throw new Error('An API run cannot accept a manually supplied response; prepare a separate file-handoff run.');
  const stage = manifest.stages.find(item => item.status === 'waiting');
  if (!stage?.request_file) throw new Error('No outstanding model request.');
  const attemptNumber = (stage.attempts?.length ?? 0) + 1;
  const responseFile = `responses/${String(stage.number).padStart(2, '0')}-${stage.name}-attempt-${String(attemptNumber).padStart(2, '0')}.json`;
  await writeFile(join(runDir, responseFile), rawResponse, { flag: 'wx' });
  const attempt: NonNullable<Stage['attempts']>[number] = { response_file: responseFile, response_sha256: sha256(rawResponse), status: 'rejected', at: now() };
  stage.attempts = [...(stage.attempts ?? []), attempt];
  let evidence: Evidence | undefined;
  let brief: Brief | undefined;
  let validation: Validation | undefined;
  let providerFile: string | null = null;
  let providerHash: string | null = null;
  if (details) {
    providerFile = `${responseFile.slice(0, -5)}-provider.json`;
    const encoded = json(details.payload);
    providerHash = sha256(encoded);
    await writeFile(join(runDir, providerFile), encoded, { flag: 'wx' });
  }
  try {
    if (Buffer.byteLength(rawResponse) > 1_000_000) throw new Error('Model response exceeds the 1 MB safety limit.');
    let value: unknown;
    try { value = JSON.parse(rawResponse); } catch { throw new Error('Response must be valid raw JSON without code fences.'); }
    if (stage.name === 'evidence') evidence = validateEvidence(value, sources, manifest.ticker, manifest.as_of, manifest.version);
    else {
      if (stage.name === 'writer') {
        const evidenceStage = manifest.stages.find(item => item.name === 'evidence')!;
        evidence = validateEvidence(await readJson(join(runDir, evidenceStage.response_file!)), sources, manifest.ticker, manifest.as_of, manifest.version);
        if (await readFile(join(runDir, 'evidence.json'), 'utf8') !== json(evidence)) throw new Error('Intermediate evidence file differs from the accepted response.');
      }
      ({ brief, validation } = validateBrief(value, sources, manifest.ticker, manifest.as_of, manifest.version, evidence));
    }
  } catch (error: any) {
    attempt.error = error.message;
    await writeFile(join(runDir, `${responseFile}.validation.json`), json({ status: 'rejected', error: error.message, at: attempt.at, note: 'Raw response preserved. This is not a completed run.' }), { flag: 'wx' });
    await writeManifest(runDir, manifest);
    throw new Error(`${error.message} Raw attempt retained at ${responseFile}.`);
  }
  attempt.status = 'accepted';
  stage.status = 'accepted';
  stage.response_file = responseFile;
  stage.response_sha256 = attempt.response_sha256;
  stage.accepted_at = now();
  stage.usage = details?.usage ?? null;
  stage.latency_ms = details?.latencyMs ?? null;
  if (details) {
    stage.reported_model = details.reportedModel ?? null;
    stage.response_id = details.responseId ?? null;
    stage.finish_reason = details.finishReason ?? null;
  }
  stage.provider_response_file = providerFile;
  stage.provider_response_sha256 = providerHash;
  if (stage.name === 'evidence') {
    await writeFile(join(runDir, 'evidence.json'), json(evidence), { flag: 'wx' });
    const next = manifest.stages.find(item => item.status === 'waiting')!;
    await exportRequest(runDir, manifest, sources, next, evidence);
    await writeManifest(runDir, manifest);
    return { status: 'awaiting_response', nextRequest: join(runDir, next.request_file!) };
  }
  manifest.status = 'completed';
  manifest.completed_at = now();
  await writeFile(join(runDir, 'brief.md'), brief!.brief_markdown, { flag: 'wx' });
  await writeFile(join(runDir, 'validation.json'), json(validation), { flag: 'wx' });
  await writeFile(join(runDir, 'report.html'), renderReport(manifest, sources, brief!, evidence, validation!, false), { flag: 'wx' });
  const outputFiles = ['brief.md', 'validation.json', 'report.html', ...(evidence ? ['evidence.json'] : [])];
  manifest.outputs = [];
  for (const file of outputFiles) manifest.outputs.push({ file, sha256: sha256(await readFile(join(runDir, file), 'utf8')) });
  await writeManifest(runDir, manifest);
  return { status: 'completed', brief: join(runDir, 'brief.md'), report: join(runDir, 'report.html'), validation };
}

export async function replay(runPath: string) {
  const runDir = resolve(runPath);
  const { manifest, sources } = await readPinned(runDir);
  if (manifest.status !== 'completed') throw new Error('Replay requires a completed recorded run.');
  let evidence: Evidence | undefined;
  let brief: Brief | undefined;
  let validation: Validation | undefined;
  for (const stage of manifest.stages) {
    if (stage.status !== 'accepted' || !stage.response_file) throw new Error('Run has an incomplete stage.');
    const response = await readFile(join(runDir, stage.response_file), 'utf8');
    if (sha256(response) !== stage.response_sha256) throw new Error('Recorded response hash mismatch.');
    if (stage.provider_response_file && sha256(await readFile(join(runDir, stage.provider_response_file), 'utf8')) !== stage.provider_response_sha256) throw new Error('Recorded provider response hash mismatch.');
    if (stage.name === 'evidence') evidence = validateEvidence(JSON.parse(response), sources, manifest.ticker, manifest.as_of, manifest.version);
    else ({ brief, validation } = validateBrief(JSON.parse(response), sources, manifest.ticker, manifest.as_of, manifest.version, evidence));
  }
  for (const output of manifest.outputs ?? []) {
    if (sha256(await readFile(join(runDir, output.file), 'utf8')) !== output.sha256) throw new Error(`Output hash mismatch: ${output.file}.`);
  }
  if (await readFile(join(runDir, 'brief.md'), 'utf8') !== brief!.brief_markdown) throw new Error('Saved brief differs from the raw model response.');
  if (evidence && await readFile(join(runDir, 'evidence.json'), 'utf8') !== json(evidence)) throw new Error('Saved evidence differs from the raw model response.');
  const cachedReport = join(runDir, 'replay.html');
  await writeFile(cachedReport, renderReport(manifest, sources, brief!, evidence, validation!, true));
  await writeFile(join(runDir, 'replay-verification.json'), json({ mode: 'cached-replay', verified_at: now(), model_calls: 0, original_run_mode: manifest.mode, source_count: sources.length, checks: ['Input, prompt, request and accepted-response hashes match', 'Recorded final output hashes match', 'Brief text matches the model response exactly', 'Current validators pass on archived responses'], validation }));
  return { status: 'verified', mode: 'cached-replay', modelCalls: 0, report: cachedReport, brief: join(runDir, 'brief.md'), validation };
}

export async function runApi(options: { ticker: string; docs: string; asOf: string; version: string; out: string; model: string; baseUrl: string; apiKey: string; apiSettings?: ApiSettings }) {
  if ((options.apiSettings ?? DEFAULT_API_SETTINGS).auth_mode === 'bearer' && !options.apiKey?.trim()) throw new Error('Set LLM_API_KEY or OPENAI_API_KEY before starting an API run, or explicitly select LLM_AUTH_MODE=none for an endpoint that accepts anonymous requests.');
  const prepared = await prepare({ ...options, mode: 'live-api' });
  for (;;) {
    const manifest = await readJson<Manifest>(join(prepared.runDir, 'manifest.json'));
    const stage = manifest.stages.find(stage => stage.status === 'waiting');
    if (!stage) return { status: 'completed', runDir: prepared.runDir, report: join(prepared.runDir, 'report.html') };
    const request = await readJson<Request>(join(prepared.runDir, stage.request_file!));
    const response = await complete(request, options);
    await accept(prepared.runDir, response.content, response);
  }
}
