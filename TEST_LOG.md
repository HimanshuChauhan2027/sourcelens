# SourceLens: actual experiment log

## What was run

Three complete research experiments used the original eight-document SRVCABLE pack. Each changed the prompt or workflow. The research cutoff was **2026-09-23**; the actual captures occurred on **2026-10-06**.

**Model:** GPT-6 Astra Pro through the ChatGPT session. Each exported stage request was given to a fresh model context. The resulting JSON was imported through SourceLens's normal file-handoff validator. These are actual captured model outputs, not synthetic fixtures, cached replays or external API benchmark calls. See `CAPTURE_NOTES.md` for the capture method.

The exact backend snapshot, sampling settings, generation duration, tokens and cost were not exposed. They are not estimated or claimed. Manifests record the operator-supplied model label and actual import timestamps. **No final brief was manually edited.**

## Results and changes

| Experiment | Design and actual generations | Observed result | What changed next |
|---|---|---|---|
| `runs/01-baseline` | v1: one direct brief generation | Accepted; 436 words. Correct official revenue, explicit conflicting news report, dated promoter-pledge denominator, qualified GST appeal and exclusion of the unrelated company and promotional recommendation. It was a competent baseline. It did not expose a separate record of why every document was used or excluded, and used EBITDA/basis-point terminology without a gloss. | Add a structured evidence stage, with decisions for every source, quoted support, conflicts and uncertainties, followed by a separate writer. |
| `runs/02-evidence` | v2: evidence generation, writer generation, then one additional writer generation after rejection. Three actual model generations. | Evidence accepted: 16 claims, 8 document decisions, 23 quoted passages. The first writer repeated every source ID in an introductory Sources sentence and again in the list; the registry validator rejected it. The recorded model retry passed and produced a 458-word brief. | Make the Sources-entry rule explicit in v3. Enforce exact evidence quotations and registry metadata. Tighten dates, forecast attribution, denominators and plain-language writing. |
| `runs/03-precision` | v3: one evidence generation and one writer generation | Both accepted on their first import. The ledger contains 15 claims, decisions for all 8 documents and 27 exact matching quotations. The final brief is 511 words, has 4 Snapshot lines and 5 cited sources. All required v3 checks passed. A separate review found no material factual error in the final brief against the supplied pack. | Retain this as the final assessment output. Record the remaining evidence-record ambiguity and semantic-validation limits below. |

Total: **3 research experiments, 6 actual model generations, 1 rejected model response and 1 recorded model retry**. A replay makes no model calls and is not a fourth experiment. Word counts use whitespace-separated tokens, including the title, headings and Sources.

### The actual v2 failure and retry

The failed writer response remains at `runs/02-evidence/responses/02-writer-attempt-01.json`, alongside its `.validation.json` error report. No one removed its duplicated IDs by hand.

A fresh model context received `runs/02-evidence/repair-request-02.json`. That file includes the frozen original request, the failed response and the actual validator feedback. The new model output is `model-writer-retry.json`, also preserved as `responses/02-writer-attempt-02.json`. This was an operator-initiated model retry, not an undisclosed automatic loop. The v3 writer prompt explicitly requires a Sources list with each cited ID appearing once.

v2 only enforces evidence structure and source references. A separate literal comparison found that all 23 v2 supporting passages also matched their referenced source bodies exactly. v3 makes this a required gate, and all 27 passages passed.

## Final brief review against the supplied evidence

| Check | Actual final result and evidence |
|---|---|
| Same-period financial conflict | Uses the issuer's Q1 revenue of ₹1,248 crore and reported 18.0% growth. Explicitly records the newer article's incompatible ₹1,428 crore / 35% figures and prefers the applicable primary results. See S03 and S01. |
| Current versus historical pledge | Uses 4.1% **of promoter holdings**, measured on 30 June 2026 and published on 15 July. The old March 2024 report is historical context in the ledger, not a claim about September 2026. See S08 and S04. |
| Different company | The Nagpur fine concerns a TV/broadband operator, not the cable manufacturer. S06 is excluded and supplies no final claims. |
| Embedded instruction and promotion | The original blog, including its hidden instruction, remains preserved as input. S05 is excluded; its stock recommendation, target and invented consensus are absent from the brief. This demonstrates the outcome on this pack only. |
| Forecasts and ambiguous language | FY27 growth and Bharuch commissioning/capacity are attributed expectations. The final brief preserves management's exact “we think that can double in two years” wording and the 9% domestic-revenue denominator. |
| Operating and financial risks | Includes reduced profitability margin, repricing lag, slower collections, reported capex/funding and the GST demand. No reported default is invented. See S02, S03 and S07. |
| GST status | States the ₹46.3 crore demand and its periods, attributes management's intended appeal and no-material-impact view, and says the filing/outcome are not established by the pack. See S07. |
| Missing valuation | Asks for current valuation inputs rather than presenting an August article's stock price as current. |
| Traceability | Every cited ID resolves to an eligible input. The registry retains original filenames, publication dates and supplied URLs. These fictional URLs were not fetched. |

### A remaining ambiguity, preserved rather than hidden

The v3 evidence ledger's C07 text interprets management's phrase “that can double” as the domestic-revenue proportion doubling. The source wording is ambiguous about that precise interpretation. Its support quotation is exact, and the final writer prudently repeats the original wording instead of asserting an 18% future share. The final brief does not make that stronger claim, but the intermediate ledger still illustrates why exact quotation matching does not establish semantic correctness. The ledger and raw model outputs are unchanged.

A second small precision issue remains in evidence-period labels C06, C07, C10 and C11: they refer to an “11 August 2026 call,” while the supplied file explicitly dates its publication, not the call itself. The final brief does not assert that exact call date. A future prompt should require “transcript published 11 August” when an event date is not separately supplied.

## Code verification actually executed

Command: `node --test tests/*.test.ts`.

**17 tests passed; 0 failed.** Tests use clearly synthetic documents and a local mock HTTP server. They are separate from the three assessment experiments and do not prove external API availability.

Coverage includes date handling, future-source withholding, preservation of original source text, malformed metadata, unknown citations, schema errors, exact quote mismatch, wrong-entity exclusions, section/citation/source-registry checks, immutable run archives, rejected-attempt preservation, exact final Markdown, changed evidence detection, API JSON mode, refusals/truncation/errors and redirect rejection. Renderer regression cases check that citation-looking text inside a URL cannot corrupt HTML and that untrusted text remains escaped.

Code review also prompted explicit rejection of HTTP redirects and a renderer fix. These are implementation changes, not invented model failures. Tests and replay establish selected mechanical properties, not authentic documents, investment merit or universal prompt-injection resistance.

## Provider compatibility update: 6 October 2026

After the original experiment verification above, provider configuration and transport controls were added. The current suite passes **24 tests; 0 failed**. New coverage checks configuration validation, explicit anonymous authentication without leaking an ambient key, optional omission of the provider JSON parameter while retaining local validation, token-parameter selection, and a two-stage mocked API run that returns different model identifiers. The run record and report distinguish the requested model selector from each provider-reported model identifier, and preserve the provider response envelope.

OpenRouter's public catalog and the providers' official documentation were checked. One actual anonymous OpenCode request returned HTTP 403 with `FreeTierError`. No OpenRouter or Groq key was supplied, so these code tests are not successful authenticated generations on those services. See `PROVIDER_SETUP.md` and the check records in `providers/` for the findings and limits.

All three existing archives were verified again. Their captured prompts and model responses remain unchanged, and the final brief retains its original SHA-256 digest. This update adds no assessment experiment and does not relabel the original model captures as free-provider runs.

## Reviewer entry points

- Final untouched brief: `runs/03-precision/brief.md`.
- Evidence and source decisions: `runs/03-precision/evidence.json`.
- Full frozen prompts and requests: each run's `prompts/` and `request-*.json`.
- Exact responses, including the rejection: each run's `responses/`.
- Per-run metadata and final checks: `manifest.json` and `validation.json`.
- Recheck the archive with `node src/cli.ts replay --run runs/03-precision`. The resulting report is labelled cached replay and makes zero model calls.

Only this fictional pack has been evaluated. No live-data or real-ticker bonus, personal screen recording, published repository or API performance benchmark is claimed.
