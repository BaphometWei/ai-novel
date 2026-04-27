import type { ProviderAdapter, TokenUsage } from '@ai-novel/domain';
import { redactSecrets } from './redaction';

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface OpenAIProviderOptions {
  apiKey: string;
  baseURL?: string;
  fetch?: FetchLike;
  inputTokenUsdPerMillion?: number;
  outputTokenUsdPerMillion?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

interface StreamCompletionChunk {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

function usageFromOpenAI(response: ChatCompletionResponse): TokenUsage {
  return {
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0
  };
}

async function openAIResponseError(response: Response): Promise<Error> {
  const body = await response.text();
  const details = body ? `: ${redactSecrets(body)}` : '';
  return new Error(`OpenAI request failed with status ${response.status}${details}`);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await openAIResponseError(response);
  }
  return (await response.json()) as T;
}

export function createOpenAIProvider(options: OpenAIProviderOptions): ProviderAdapter {
  const baseURL = options.baseURL ?? 'https://api.openai.com/v1';
  const fetchImpl = options.fetch ?? fetch;
  const inputRate = options.inputTokenUsdPerMillion ?? 5;
  const outputRate = options.outputTokenUsdPerMillion ?? 15;

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchImpl(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    return readJson<T>(response);
  }

  async function post(path: string, body: unknown): Promise<Response> {
    const response = await fetchImpl(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw await openAIResponseError(response);
    }
    return response;
  }

  return {
    name: 'openai',
    async generateText(input: { prompt: string; model?: string }) {
      const response = await postJson<ChatCompletionResponse>('/chat/completions', {
        model: input.model,
        messages: [{ role: 'user', content: input.prompt }]
      });
      return {
        text: response.choices?.[0]?.message?.content ?? '',
        usage: usageFromOpenAI(response)
      };
    },
    async generateStructured<T>(input: { prompt: string; schemaName: string; model?: string }) {
      const response = await postJson<ChatCompletionResponse>('/chat/completions', {
        model: input.model,
        messages: [
          { role: 'system', content: `Return valid JSON for schema ${input.schemaName}.` },
          { role: 'user', content: input.prompt }
        ],
        response_format: { type: 'json_object' }
      });
      const content = response.choices?.[0]?.message?.content ?? '{}';
      return {
        value: JSON.parse(content) as T,
        usage: usageFromOpenAI(response)
      };
    },
    async *streamText(input: { prompt: string; model?: string }) {
      const response = await post('/chat/completions', {
        model: input.model,
        messages: [{ role: 'user', content: input.prompt }],
        stream: true,
        stream_options: { include_usage: true }
      });
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let eventEnd = buffer.indexOf('\n\n');
        while (eventEnd >= 0) {
          const event = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice('data:'.length).trim();
            if (!data || data === '[DONE]') continue;
            const chunk = JSON.parse(data) as StreamCompletionChunk;
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) yield text;
            if (chunk.usage) {
              yield { text: '', usage: usageFromOpenAI({ usage: chunk.usage }) };
            }
          }
          eventEnd = buffer.indexOf('\n\n');
        }
      }
    },
    async embedText(input: { text: string; model?: string }) {
      const response = await postJson<EmbeddingResponse>('/embeddings', {
        model: input.model,
        input: input.text
      });
      return {
        vector: response.data?.[0]?.embedding ?? [],
        model: input.model ?? 'unknown'
      };
    },
    estimateCost(input) {
      return {
        estimatedUsd:
          (input.inputTokens / 1_000_000) * inputRate + (input.outputTokens / 1_000_000) * outputRate
      };
    }
  };
}
