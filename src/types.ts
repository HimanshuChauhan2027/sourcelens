export type Source = {
  id: string;
  filename: string;
  source: string;
  url: string;
  published: string;
  type: string;
  body: string;
  raw: string;
  sha256: string;
  eligible: boolean;
};

export type Evidence = {
  ticker: string;
  as_of: string;
  document_decisions: {
    source_id: string;
    disposition: 'use' | 'context' | 'exclude';
    entity_match: boolean | 'uncertain';
    reason: string;
  }[];
  claims: {
    id: string;
    text: string;
    source_ids: string[];
    support: { source_id: string; quote: string }[];
    period: string;
    kind: 'reported_fact' | 'management_expectation' | 'inference';
  }[];
  conflicts: {
    id: string;
    claim: string;
    source_ids: string[];
    resolution: string;
    preferred_source_ids: string[];
  }[];
  uncertainties: { question: string; source_ids: string[] }[];
};

export type Brief = { ticker: string; as_of: string; brief_markdown: string };

export type ApiSettings = {
  reasoning_effort?: string;
  auth_mode: 'bearer' | 'none';
  json_mode: 'json_object' | 'prompt';
  output_token_limit: number | null;
  token_parameter: 'max_completion_tokens' | 'max_tokens';
  timeout_seconds: number;
};

export type StageName = 'baseline' | 'evidence' | 'writer';
export type Version = 'v1' | 'v2' | 'v3';

export type Stage = {
  number: number;
  name: StageName;
  prompt_file: string;
  prompt_sha256: string;
  status: 'waiting' | 'accepted';
  request_file?: string;
  request_sha256?: string;
  response_file?: string;
  response_sha256?: string;
  accepted_at?: string;
  usage?: unknown;
  latency_ms?: number | null;
  reported_model?: string | null;
  response_id?: string | null;
  finish_reason?: string | null;
  provider_response_file?: string | null;
  provider_response_sha256?: string | null;
  attempts?: { response_file: string; response_sha256: string; status: 'accepted' | 'rejected'; at: string; error?: string }[];
};

export type Manifest = {
  schema_version: 1;
  application: 'SourceLens';
  run_id: string;
  ticker: string;
  as_of: string;
  version: Version;
  mode: 'file-handoff' | 'live-api';
  created_at: string;
  completed_at?: string;
  status: 'awaiting_response' | 'completed';
  model: {
    identifier: string;
    transport: 'file-handoff' | 'openai-compatible-chat-completions';
    identity_source: 'operator-supplied' | 'api-request';
    base_url?: string;
    settings: Record<string, unknown> & Partial<ApiSettings>;
  };
  inputs: {
    snapshot_file: string;
    snapshot_sha256: string;
    sources: { source_id: string; filename: string; sha256: string; eligible: boolean }[];
  };
  stages: Stage[];
  outputs?: { file: string; sha256: string }[];
};

export type Request = {
  stage: StageName;
  prompt_version: Version;
  ticker: string;
  as_of: string;
  model: Manifest['model'];
  system: string;
  user: string;
  response_format?: { type: 'json_object' };
  max_completion_tokens?: number;
  max_tokens?: number;
};

export type Validation = {
  status: 'passed';
  checks: string[];
  warnings: string[];
  word_count?: number;
  limitation: string;
};
