import { describe, expect, it } from 'vitest';
import { createOpenAIProvider } from './openai-provider';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

describe('OpenAI provider adapter', () => {
  it('builds OpenAI-compatible text requests without exposing api keys in returned metadata', async () => {
    const seenRequests: Array<{ url: string; headers: Headers; body: unknown }> = [];
    const provider = createOpenAIProvider({
      apiKey: 'sk-local-test-secret',
      baseURL: 'https://api.openai.com/v1',
      fetch: async (url, init) => {
        seenRequests.push({
          url: String(url),
          headers: new Headers(init?.headers),
          body: JSON.parse(String(init?.body))
        });
        return jsonResponse({
          choices: [{ message: { content: 'Draft' } }],
          usage: { prompt_tokens: 2, completion_tokens: 3 }
        });
      }
    });

    const result = await provider.generateText({ model: 'gpt-test', prompt: 'write' });

    expect(result).toEqual({ text: 'Draft', usage: { inputTokens: 2, outputTokens: 3 } });
    expect(seenRequests[0]).toMatchObject({
      url: 'https://api.openai.com/v1/chat/completions',
      body: { model: 'gpt-test', messages: [{ role: 'user', content: 'write' }] }
    });
    expect(seenRequests[0]?.headers.get('authorization')).toBe('Bearer sk-local-test-secret');
    expect(JSON.stringify(result)).not.toContain('sk-local-test-secret');
  });

  it('supports structured JSON output and embeddings through the same provider boundary', async () => {
    const provider = createOpenAIProvider({
      apiKey: 'sk-local-test-secret',
      fetch: async (url) => {
        if (String(url).endsWith('/embeddings')) {
          return jsonResponse({
            data: [{ embedding: [0.1, 0.2, 0.3] }]
          });
        }
        return jsonResponse({
          choices: [{ message: { content: '{"title":"Chapter"}' } }],
          usage: { prompt_tokens: 4, completion_tokens: 5 }
        });
      }
    });

    await expect(provider.generateStructured<{ title: string }>({
      model: 'gpt-test',
      prompt: 'plan',
      schemaName: 'ChapterPlan'
    })).resolves.toEqual({
      value: { title: 'Chapter' },
      usage: { inputTokens: 4, outputTokens: 5 }
    });
    await expect(provider.embedText({ model: 'embedding-test', text: 'canon' })).resolves.toEqual({
      vector: [0.1, 0.2, 0.3],
      model: 'embedding-test'
    });
  });

  it('streams OpenAI-compatible SSE chunks instead of waiting for a full completion response', async () => {
    const encoder = new TextEncoder();
    const seenBodies: unknown[] = [];
    const provider = createOpenAIProvider({
      apiKey: 'sk-local-test-secret',
      fetch: async (_url, init) => {
        seenBodies.push(JSON.parse(String(init.body)));
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'));
              controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'));
              controller.enqueue(encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":2}}\n\n'));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream' } }
        );
      }
    });

    const chunks: string[] = [];
    let usage;
    for await (const chunk of provider.streamText({ model: 'gpt-test', prompt: 'stream' })) {
      if (typeof chunk === 'string') {
        chunks.push(chunk);
      } else {
        if (chunk.text) chunks.push(chunk.text);
        usage = chunk.usage;
      }
    }

    expect(seenBodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(chunks).toEqual(['Hel', 'lo']);
    expect(usage).toEqual({ inputTokens: 2, outputTokens: 2 });
  });

  it('redacts secrets from non-ok response errors', async () => {
    const provider = createOpenAIProvider({
      apiKey: 'sk-local-test-secret',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: 'invalid apiKey="body-secret" for Bearer sk-response-secret'
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
    });

    await expect(provider.generateText({ model: 'gpt-test', prompt: 'write' })).rejects.toThrow(
      'OpenAI request failed with status 401: {"error":"invalid apiKey=\\"[REDACTED]\\" for Bearer [REDACTED]"}'
    );
    await expect(provider.generateText({ model: 'gpt-test', prompt: 'write' })).rejects.not.toThrow(
      /body-secret|sk-response-secret|sk-local-test-secret/
    );
  });
});
