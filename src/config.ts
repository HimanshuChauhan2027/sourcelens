import type { ApiSettings, Request } from './types.ts';

export const DEFAULT_API_SETTINGS: Readonly<ApiSettings> = Object.freeze({
  auth_mode: 'bearer',
  json_mode: 'json_object',
  output_token_limit: null,
  token_parameter: 'max_completion_tokens',
  timeout_seconds: 120,
});

export function apiConfigFromEnv(env: Record<string, string | undefined> = process.env) {
  const choice = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
    const value = env[name]?.trim() || fallback;
    if (!allowed.includes(value as T)) throw new Error(`${name} must be ${allowed.join(' or ')}.`);
    return value as T;
  };
  const authMode = choice('LLM_AUTH_MODE', ['bearer', 'none'], DEFAULT_API_SETTINGS.auth_mode);
  const jsonMode = choice('LLM_JSON_MODE', ['json_object', 'prompt'], DEFAULT_API_SETTINGS.json_mode);
  const tokenParameter = choice('LLM_TOKEN_PARAMETER', ['max_completion_tokens', 'max_tokens'], DEFAULT_API_SETTINGS.token_parameter);
  const tokenText = env.LLM_MAX_TOKENS?.trim();
  let outputTokenLimit: number | null = null;
  if (tokenText) {
    outputTokenLimit = Number(tokenText);
    if (!/^\d+$/.test(tokenText) || !Number.isSafeInteger(outputTokenLimit) || outputTokenLimit < 1) throw new Error('LLM_MAX_TOKENS must be a positive integer when supplied.');
  }
  const timeoutText = env.LLM_TIMEOUT_SECONDS?.trim();
  const timeoutSeconds = timeoutText ? Number(timeoutText) : DEFAULT_API_SETTINGS.timeout_seconds;
  if ((timeoutText && !/^\d+(?:\.\d+)?$/.test(timeoutText)) || !Number.isFinite(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 600) throw new Error('LLM_TIMEOUT_SECONDS must be a number between 1 and 600.');
  const effort = env.LLM_REASONING_EFFORT?.trim();
  if (effort && !["none", "minimal", "low", "medium", "high"].includes(effort)) throw new Error("LLM_REASONING_EFFORT is invalid.");
  const apiSettings: ApiSettings = {
    ...(effort ? { reasoning_effort: effort } : {}),
    auth_mode: authMode, json_mode: jsonMode, output_token_limit: outputTokenLimit,
    token_parameter: tokenParameter, timeout_seconds: timeoutSeconds,
  };
  return {
    baseUrl: env.LLM_BASE_URL?.trim() || 'https://api.openai.com/v1',
    apiKey: authMode === 'none' ? '' : env.LLM_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || '',
    apiSettings,
  };
}

export function completionParameters(settings: ApiSettings): Pick<Request, 'response_format' | 'max_completion_tokens' | 'max_tokens'> & { reasoning_effort?: string } {
  return {
    ...(settings.reasoning_effort ? { reasoning_effort: settings.reasoning_effort } : {}),
    ...(settings.json_mode === 'json_object' ? { response_format: { type: 'json_object' as const } } : {}),
    ...(settings.output_token_limit === null ? {} : { [settings.token_parameter]: settings.output_token_limit }),
  };
}
