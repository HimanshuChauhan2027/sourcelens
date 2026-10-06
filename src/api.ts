import { completionParameters, DEFAULT_API_SETTINGS } from './config.ts';
import type { ApiSettings, Request } from './types.ts';

export function endpoint(baseUrl: string): string {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error('LLM_BASE_URL must be a valid URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('LLM_BASE_URL must use HTTPS (HTTP is allowed only for a local test server).');
  if (url.username || url.password || url.search || url.hash) throw new Error('LLM_BASE_URL must not include credentials, a query or a fragment.');
  const path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/chat/completions')) throw new Error('LLM_BASE_URL must end at the API base, before /chat/completions.');
  url.pathname = `${path}/chat/completions`;
  return url.toString();
}

export async function complete(request: Request, options: { baseUrl: string; apiKey: string; apiSettings?: ApiSettings }) {
  const settings = options.apiSettings ?? DEFAULT_API_SETTINGS;
  if (settings.auth_mode === 'bearer' && !options.apiKey?.trim()) throw new Error('Set LLM_API_KEY or OPENAI_API_KEY before an API run, or explicitly select LLM_AUTH_MODE=none for an endpoint that accepts anonymous requests.');
  const url = endpoint(options.baseUrl);
  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(settings.auth_mode === 'bearer' ? { Authorization: `Bearer ${options.apiKey.trim()}` } : {}) },
      body: JSON.stringify({ model: request.model.identifier, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }], ...completionParameters(settings) }),
      signal: AbortSignal.timeout(Math.ceil(settings.timeout_seconds * 1000)),
    });
  } catch {
    throw new Error('Model request failed or timed out. Check connectivity and endpoint configuration; no credentials were logged.');
  }
  if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}. Check access, model availability and quota. Response bodies are not printed.`);
  let payload: any;
  try { payload = await response.json(); } catch { throw new Error('Model endpoint returned a non-JSON response.'); }
  const choice = payload?.choices?.[0];
  if (choice?.message?.refusal) throw new Error('The model refused this request; no completed output was accepted.');
  if (choice?.finish_reason !== 'stop') throw new Error(`Model response did not finish normally (${typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'missing finish reason'}). No partial output was accepted.`);
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Model returned no usable text content.');
  return {
    content, payload, usage: payload.usage ?? null, latencyMs: Math.round(performance.now() - start),
    reportedModel: typeof payload.model === 'string' && payload.model.trim() ? payload.model : null,
    responseId: typeof payload.id === 'string' && payload.id.trim() ? payload.id : null,
    finishReason: choice.finish_reason as string,
  };
}
