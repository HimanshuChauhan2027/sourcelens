import test from 'node:test';
import assert from 'node:assert/strict';
import { apiConfigFromEnv } from '../src/config.ts';

test('API configuration uses defaults and a blank generic key falls back to the OpenAI key', () => {
  const config = apiConfigFromEnv({ LLM_API_KEY: '  ', OPENAI_API_KEY: '  fallback-test-key  ' });
  assert.equal(config.apiKey, 'fallback-test-key');
  assert.equal(config.baseUrl, 'https://api.openai.com/v1');
  assert.deepEqual(config.apiSettings, {
    auth_mode: 'bearer', json_mode: 'json_object', output_token_limit: null,
    token_parameter: 'max_completion_tokens', timeout_seconds: 120,
  });
  assert.equal(apiConfigFromEnv({ LLM_API_KEY: ' generic-test-key ', OPENAI_API_KEY: 'alternative-test-key' }).apiKey, 'generic-test-key');
});

test('anonymous configuration discards environment credentials and supports explicit transport choices', () => {
  const config = apiConfigFromEnv({
    LLM_BASE_URL: ' https://provider.test/openai/v1 ', LLM_API_KEY: 'unused-test-key', OPENAI_API_KEY: 'another-unused-key',
    LLM_AUTH_MODE: 'none', LLM_JSON_MODE: 'prompt', LLM_MAX_TOKENS: '4096',
    LLM_TOKEN_PARAMETER: 'max_tokens', LLM_TIMEOUT_SECONDS: '2.5',
  });
  assert.equal(config.apiKey, '');
  assert.equal(config.baseUrl, 'https://provider.test/openai/v1');
  assert.deepEqual(config.apiSettings, {
    auth_mode: 'none', json_mode: 'prompt', output_token_limit: 4096,
    token_parameter: 'max_tokens', timeout_seconds: 2.5,
  });
});

test('malformed API environment settings fail before a request can start', () => {
  const invalid: Record<string, string[]> = {
    LLM_AUTH_MODE: ['automatic', 'NONE'],
    LLM_JSON_MODE: ['auto', 'json_schema'],
    LLM_TOKEN_PARAMETER: ['tokens', 'max_output_tokens'],
    LLM_MAX_TOKENS: ['0', '-1', '1.5', 'NaN', 'Infinity', '1e3', '9007199254740992', '100 tokens'],
    LLM_TIMEOUT_SECONDS: ['0', '601', 'NaN', 'Infinity', '120 seconds', '0x78'],
  };
  for (const [name, values] of Object.entries(invalid)) {
    for (const value of values) assert.throws(() => apiConfigFromEnv({ [name]: value }), new RegExp(name));
  }
  assert.equal(apiConfigFromEnv({ LLM_MAX_TOKENS: '', LLM_TIMEOUT_SECONDS: '' }).apiSettings.output_token_limit, null);
  assert.equal(apiConfigFromEnv({ LLM_TIMEOUT_SECONDS: '1' }).apiSettings.timeout_seconds, 1);
  assert.equal(apiConfigFromEnv({ LLM_TIMEOUT_SECONDS: '600' }).apiSettings.timeout_seconds, 600);
});

test('reasoning effort is explicit, archived in settings and included in request parameters', async () => {
  const { completionParameters } = await import('../src/config.ts');
  const settings = apiConfigFromEnv({ LLM_REASONING_EFFORT: 'none' }).apiSettings;
  assert.equal(settings.reasoning_effort, 'none');
  assert.equal(completionParameters(settings).reasoning_effort, 'none');
  assert.equal(completionParameters(apiConfigFromEnv({}).apiSettings).reasoning_effort, undefined);
  assert.throws(() => apiConfigFromEnv({ LLM_REASONING_EFFORT: 'invalid' }), /LLM_REASONING_EFFORT/);
});
