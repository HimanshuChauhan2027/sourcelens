import { readFile } from 'node:fs/promises';
import { accept, prepare, replay, runApi } from './run.ts';
import { apiConfigFromEnv } from './config.ts';

const help = `SourceLens · cited research from a folder of documents

Node 22.18+ required. No package installation needed.

Prepare a genuine model request, without an API key:
  node src/cli.ts prepare --ticker SRVCABLE --docs research_pack --as-of 2026-09-23 --version v1 --out runs/01-baseline --model "actual model label"

Accept that model's raw JSON response:
  node src/cli.ts accept --run runs/01-baseline --response /path/to/response.json

Run with a configured OpenAI-compatible API:
  node --env-file=.env src/cli.ts run --ticker SRVCABLE --docs research_pack --as-of 2026-09-23 --version v3 --out runs/new-api-run

API environment settings:
  LLM_BASE_URL, LLM_MODEL, LLM_API_KEY (or OPENAI_API_KEY)
  LLM_AUTH_MODE=bearer|none (default bearer; none sends no Authorization header)
  LLM_JSON_MODE=json_object|prompt (default json_object; prompt omits response_format)
  LLM_MAX_TOKENS (optional positive integer)
  LLM_TOKEN_PARAMETER=max_completion_tokens|max_tokens (default max_completion_tokens)
  LLM_TIMEOUT_SECONDS=120 (range 1–600)

Verify an archived run, with zero model calls:
  node src/cli.ts replay --run runs/03-precision

v1: direct brief · v2: evidence then writer · v3: precision and provenance checks
`;

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') { process.stdout.write(help); process.exit(0); }
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) throw new Error('Use --flag value pairs. See --help.');
    if (Object.hasOwn(flags, key.slice(2))) throw new Error(`Duplicate flag: ${key}.`);
    flags[key.slice(2)] = value;
  }
  const allowed: Record<string, string[]> = { prepare: ['ticker', 'docs', 'as-of', 'version', 'out', 'model'], run: ['ticker', 'docs', 'as-of', 'version', 'out', 'model'], accept: ['run', 'response'], replay: ['run'] };
  if (!allowed[command]) throw new Error('Unknown command. See --help.');
  for (const key of Object.keys(flags)) if (!allowed[command].includes(key)) throw new Error(`Unknown flag --${key} for ${command}.`);
  const required = (name: string) => { if (!flags[name]) throw new Error(`Missing --${name}.`); return flags[name]; };
  let result: unknown;
  if (command === 'accept') result = await accept(required('run'), await readFile(required('response'), 'utf8'));
  else if (command === 'replay') result = await replay(required('run'));
  else {
    const options = { ticker: required('ticker'), docs: required('docs'), asOf: required('as-of'), version: flags.version ?? 'v3', out: required('out'), model: flags.model ?? process.env.LLM_MODEL ?? '' };
    if (command === 'prepare') result = await prepare(options);
    else result = await runApi({ ...options, ...apiConfigFromEnv() });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`SourceLens: ${error instanceof Error ? error.message : 'Unexpected failure.'}\n`);
  process.exitCode = 1;
}
