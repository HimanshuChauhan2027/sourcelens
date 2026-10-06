# SourceLens submission checklist

## Included and completed

- [x] Working TypeScript CLI, separate versioned system prompts and documented model choice.
- [x] Original assignment and all eight research documents, unchanged.
- [x] Three complete actual model experiments, with frozen requests, raw accepted/rejected responses and manifests.
- [x] Actual observations and the recorded v2 model retry in `TEST_LOG.md` and `CAPTURE_NOTES.md`.
- [x] Final source review, 24 passing unit tests after the provider compatibility update and successful archive verification for all three runs.
- [x] `runs/03-precision/brief.md` exactly matches the final model response. No final manual edits.
- [x] Self-contained HTML report and a concrete recording guide.

## Each submitter still needs to do

- [ ] Read the README, final brief, evidence decisions and test log. Be able to explain the design and limitations in your own words.
- [ ] Unzip and run the quick start locally. Use a fresh output directory for any new model generation.
- [ ] Publish the finished project to a repository you are allowed to share. Include prompts, research inputs and captured runs; exclude credentials. Check that the reviewer can open it.
- [ ] Paste the actual repository URL into the build-link field. A ZIP is not a published repository link.
- [ ] Paste `runs/03-precision/brief.md` exactly into the brief field, including Sources. If making later manual edits, preserve the original and disclose the edits.
- [ ] Include the actual three-run observations from `TEST_LOG.md`. Replays and unit tests are not additional model experiments.
- [ ] Make a real 2–3 minute screen recording using `RECORDING_GUIDE.md`: show the program running, one visible design decision and one limitation. Label any cached replay clearly.
- [ ] Upload the recording, verify its access and paste the real link in the form.

The packaged model outputs were captured through the documented ChatGPT file-handoff workflow. Automated API generation needs an API credential and compatible model. Exact backend settings, API token usage, latency and cost are not claimed for these captures. No real-ticker/live-data bonus is included.
