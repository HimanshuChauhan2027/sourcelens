# SourceLens

**Local UI added:** read [START_HERE.txt](START_HERE.txt), then run `python3 webui.py`. Saved examples work without keys. The new live Groq attempts did not complete; see [LIVE_TEST_RESULTS.txt](LIVE_TEST_RESULTS.txt). OpenRouter is still unverified with a key.

A small research agent that produces a one-page stock brief and an inspectable evidence record. Its main design decision is to **preserve why a source was selected, superseded or excluded before writing the brief**.

The supplied SRVCABLE company is fictional. This project uses only the eight provided documents and fixes the demo research date at **23 September 2026**. The `.example` URLs are supplied source metadata; they were not fetched. The local files and input snapshots are the evidence.

## Free API providers

See [PROVIDER_SETUP.md](PROVIDER_SETUP.md) for current OpenRouter and Groq setup, ready-to-copy environment profiles, quota considerations and the actual OpenCode free-tier rejection. New API runs support explicit authentication/JSON modes, output budgets and timeouts, and distinguish requested selectors from provider-reported model identifiers. Existing captured assessment runs are unchanged.

## Quick start

Requires **Node.js 22.18 or newer**. Native TypeScript execution is used; there are no packages to install.

```bash
node --test tests/*.test.ts
node src/cli.ts replay --run runs/03-precision
```

Open `runs/03-precision/replay.html` in a browser. It contains the brief, expandable supporting quotes, source decisions and mechanical checks. This is explicitly a **cached replay with zero model calls**, not a new generation. It verifies the saved source, prompt, request, response and final-output hashes before displaying the archive. The unchanged final Markdown is `runs/03-precision/brief.md`.

## Generate with an API

Copy `.env.example` to `.env`, then set `LLM_API_KEY` and `LLM_MODEL`. `OPENAI_API_KEY` is also accepted. `LLM_BASE_URL` defaults to `https://api.openai.com/v1`; another compatible HTTPS endpoint may be used.

```bash
node --env-file=.env src/cli.ts run \
  --ticker SRVCABLE --docs research_pack --as-of 2026-09-23 \
  --version v3 --out runs/new-api-run
```

The adapter uses Chat Completions, with JSON object mode by default, no SDK and no assumed temperature setting. Explicit prompt-only JSON mode is available for compatible endpoints that reject `response_format`; local validation remains mandatory. The chosen model must support this interface. **JSON mode does not guarantee the required schema**; responses are validated locally. Refusals, incomplete generations and empty responses are rejected. Bearer authentication is the default. Explicit anonymous mode omits the header only for endpoints that permit it. Credentials are never written to run metadata or printed. Existing runs cannot be overwritten.

An API key is not required for tests, replay or the response-file workflow below. The live provider path is covered by local mock HTTP tests; successful mock calls do not demonstrate that a particular external account or model is available.

## Generate through a model session, without an API key

This is a transparent manual handoff: the CLI prepares a request, a real model session generates JSON, and the CLI validates the captured response. It is not represented as an automated API call.

```bash
node src/cli.ts prepare \
  --ticker SRVCABLE --docs research_pack --as-of 2026-09-23 \
  --version v3 --out runs/new-handoff \
  --model "Actual model label shown in your model session"
```

1. Read `runs/new-handoff/request-01.md`. Use its SYSTEM section as instructions and USER section as the task in a model session.
2. Save the model's JSON output exactly, without code fences, to a response file. Do not manually improve the brief.
3. Accept it:

```bash
node src/cli.ts accept --run runs/new-handoff --response /path/to/evidence-response.json
```

4. For v2/v3, repeat with the generated `request-02.md`, then accept that model response:

```bash
node src/cli.ts accept --run runs/new-handoff --response /path/to/writer-response.json
```

The CLI preserves every attempted raw response, including rejected ones. If validation fails, make a new model attempt; do not edit a failed response and describe it as an untouched generation. The completed run records the operator-supplied model label, manual transport and actual capture timestamps. Exact serving snapshot, sampling settings, tokens and latency are **not exposed for this mode and are not invented**.

See `TEST_LOG.md` and the individual `manifest.json` files for the actual model and observed results of the packaged experiments. Model choice should favour reliable document comparison and JSON output over orchestration complexity. The architecture uses one selected model for both stages; the writer receives the accepted evidence and source index instead of the full scraped documents.

## Model used in the recorded experiments

The included experiments use **GPT-6 Astra Pro through the ChatGPT session**, with a fresh model context for each exported stage request. This model was available for the assessment workflow and handled the short documents and structured JSON responses without a separate API credential. The actual outcomes, including a rejected writer attempt and its recorded model retry, are in `TEST_LOG.md`.

The exact serving snapshot and sampling settings were not exposed. These are real captured model-session outputs in the file-handoff workflow, not external API benchmark results. No API latency, token count or cost is claimed for them. The HTTP adapter was tested with a local mock endpoint.

## Three experimental versions

| Version | Design | What changes |
|---|---|---|
| v1 | Direct brief | One model call with the task, document set, citations and untrusted-input rule. |
| v2 | Evidence, then writer | Adds per-document decisions, supported claims, conflicts and uncertainties. The writer uses this structured record. |
| v3 | Precision and provenance | Adds explicit date, denominator, forecast and source-conflict rules, exact quote matching, cited-line coverage and source-registry metadata checks. |

Each version has separate system prompts under `prompts/`. Every run copies and hashes the prompts it actually used. v2 validates the evidence shape and references; v3 additionally requires supporting quotations to occur exactly in the source body. Distinctions such as domestic revenue versus total revenue are model instructions and human-review criteria; the code does not pretend to infer them mechanically.

## How it works

1. **Load and pin inputs.** Sort Markdown filenames to assign source IDs. Read the source/URL/date/type header, preserve the original document text, and hash it. Documents published after the requested date stay in the input archive but are withheld from the model. Source IDs are stable for the same filenames; the manifest pins their meaning per run.
2. **Select evidence.** The model identifies the correct entity, historical context, usable claims, incompatible numbers, expectations and gaps. Each accepted claim carries exact source excerpts and its period or forecast horizon. Production code contains no SRVCABLE answers.
3. **Write.** The model creates the five required sections from the accepted evidence. The brief itself remains unchanged from the captured JSON response.
4. **Check and display.** Validate the schema, citations and required format; v3 adds quote and precision-related structural checks. Generate a self-contained HTML view with escaped source text and no external assets or scripts.

The entire supplied pack fits comfortably in a single request, so a search index, vector database and retrieval layer are unnecessary for this example. For much larger packs, document selection and token-budget handling would need additional work.

## Files reviewers should inspect

| File | Purpose |
|---|---|
| `runs/03-precision/brief.md` | Final brief to paste exactly as generated. |
| `runs/03-precision/evidence.json` | Source decisions, claims, quotations, conflicts and open questions. |
| `runs/*/manifest.json` | Model/transport metadata, timestamps, prompt hashes and input/output hashes. |
| `runs/*/responses/` | Original accepted and rejected responses; provider envelopes for API calls. |
| `runs/*/request-*.json` | Complete actual model requests. |
| `prompts/` | Separate versioned system prompts. |
| `TEST_LOG.md` | Genuine prompt/design iterations and observed outcomes. |
| `RECORDING_GUIDE.md` | A concrete 2–3 minute demonstration plan. |
| `assignment/README.md` | Original assignment, unchanged. |
| `research_pack/` | Original eight source files, unchanged. |

## Limits and what the checks establish

- A real quotation can be cited beside a conclusion it does not support. Exact matching establishes **provenance, not entailment**. Human review remains necessary.
- Source metadata is supplied by the document pack. A primary filing is preferred for its applicable reported figures, but its authenticity and every management assertion are not independently verified.
- The evidence stage still reads malicious text. Instruction hierarchy, separation and validation reduce exposure; success on this pack does not prove universal prompt-injection protection.
- The as-of filter uses publication dates. The model must still distinguish a document's date from the date its figures measure.
- A cited-line check is a useful format gate, not a claim-level proof. Missing evidence is recorded as a question rather than guessed.
- Hashes detect accidental edits relative to the manifest; they are not cryptographic signatures or tamper-proof attestations.
- No live-data bonus is claimed. The tool can accept another ticker and similarly formatted documents, but unseen companies need their own evaluation.

API interface references: [Chat Completions create](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) and [Structured Outputs / JSON mode](https://developers.openai.com/api/docs/guides/structured-outputs). The implementation deliberately uses the smaller compatible JSON mode interface and validates its own schema.
