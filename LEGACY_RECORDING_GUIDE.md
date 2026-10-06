# Recording guide · 2–3 minutes

The assignment asks to show the agent running. A cached replay is useful for checking the package, but label it honestly and include a **fresh generation** in the submission recording.

## Prepare

- Use a new output directory such as `runs/recording-live` or `runs/recording-handoff`.
- Keep the terminal, model session and report ready to switch between. Use readable text sizes.
- Do not show `.env`, tokens, account secrets or unrelated tabs.
- You may pause or trim model waiting time. Say so if the recording is edited; do not present archived output as a fresh call.

## Suggested walkthrough

| Time | Show | Explain |
|---|---|---|
| 0:00–0:20 | Ticker, source folder and command | “SourceLens creates a short research brief and records why it accepted or rejected evidence. This example is fictional, and the research date is 23 September 2026.” |
| 0:20–0:55 | A new model generation | Run the API command, or show `prepare`, generation in the model session and `accept`. For manual handoff, state that the session response is captured into the CLI, rather than implying an API call. |
| 0:55–1:30 | Brief and conflicting-source decision | Open the resulting report. Show the official quarterly result, the conflicting article and the evidence record's choice. Explain why a newer secondary article does not automatically override the applicable primary source. |
| 1:30–2:00 | One quoted claim and source decisions | Expand a claim to show the exact local excerpt. Show how the different cable-TV entity and the promotional blog are excluded. |
| 2:00–2:30 | Actual test log | State what actually changed from v1 to v2 to v3 and one observed outcome. If the baseline was already factually good, say so; explain the gain in traceability or precision. |
| 2:30–2:55 | Limitation and run metadata | “A matching quotation proves where the text came from, not that every conclusion is correct. The agent cannot authenticate the supplied files or settle missing outcomes. Model metadata and raw responses are saved, and the final brief is unchanged.” |

## Commands

Fresh API generation, once `.env` is configured:

```bash
node --env-file=.env src/cli.ts run --ticker SRVCABLE --docs research_pack --as-of 2026-09-23 --version v3 --out runs/recording-live
```

Manual model-session generation:

```bash
node src/cli.ts prepare --ticker SRVCABLE --docs research_pack --as-of 2026-09-23 --version v3 --out runs/recording-handoff --model "Actual model label"
node src/cli.ts accept --run runs/recording-handoff --response /path/to/fresh-evidence-response.json
node src/cli.ts accept --run runs/recording-handoff --response /path/to/fresh-writer-response.json
```

Generate the two responses from the corresponding requests between those commands. Use a local screen recorder, then upload the finished 2–3 minute video to the location requested by the assessment.

For review only, this command uses no model and displays the saved experiment:

```bash
node src/cli.ts replay --run runs/03-precision
```

No recording is included merely because this script exists. A real screen recording must still be created and its access checked before submission.
