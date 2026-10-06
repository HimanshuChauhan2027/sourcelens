# Capture notes

The recorded assessment experiments were generated through GPT-6 Astra Pro in the ChatGPT session on 6 October 2026. The requested research date was separately fixed at 23 September 2026.

The local program exported a frozen JSON request for each stage. A fresh model context received that request, generated a JSON response, and saved the response to a file. The program then imported the response through its normal acceptance and validation path. This is the supported response-file workflow, not an external model API call. Source files, requests, responses and acceptance timestamps are retained.

The exact backend model snapshot, sampling settings, generation latency, token consumption and API cost were not exposed. The manifests leave those measurements unknown. Acceptance timestamps describe local imports, not model inference time. A cached replay makes no new model calls.

The generated Markdown is saved directly from the accepted response's brief_markdown field. No final brief was manually rewritten. Unit tests use explicitly synthetic fixtures and do not count as model experiments.

## Recorded additional attempt

The first v2 writer response failed the duplicate Sources-registry check. It remains unchanged at `runs/02-evidence/responses/02-writer-attempt-01.json`. A fresh model context received `runs/02-evidence/repair-request-02.json`, which contains the original request, previous response and actual validator feedback. Its new output is `model-writer-retry.json`, also preserved as the accepted second writer attempt. This additional model turn is included in the experiment count.

Retry request SHA-256: `d4ffe72e0548255d1e44af4c53922ecf04b05d50912bb15bb634195942037609`.
