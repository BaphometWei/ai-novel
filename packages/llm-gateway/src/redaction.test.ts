import { describe, expect, it } from 'vitest';
import { redactSecrets } from './redaction';

describe('redactSecrets', () => {
  it('redacts provider tokens and api key values', () => {
    const message = [
      'sk-local-test-secret',
      'Bearer sk-bearer-test-secret',
      'api_key="plain-secret"',
      '"apiKey":"json-secret"'
    ].join(' ');

    const redacted = redactSecrets(message);

    expect(redacted).toBe(
      '[REDACTED] Bearer [REDACTED] api_key="[REDACTED]" "apiKey":"[REDACTED]"'
    );
    expect(redacted).not.toContain('sk-local-test-secret');
    expect(redacted).not.toContain('sk-bearer-test-secret');
    expect(redacted).not.toContain('plain-secret');
    expect(redacted).not.toContain('json-secret');
  });
});
