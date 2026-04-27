const REDACTED = '[REDACTED]';

export function redactSecrets(input: string): string {
  return input
    .replace(/\bBearer\s+[^"'\s,}]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]+/g, REDACTED)
    .replace(/(["'])(api_key|apiKey)\1(\s*:\s*)(["'])([^"']+)\4/g, (_match, keyQuote, key, separator, valueQuote) => {
      return `${keyQuote}${key}${keyQuote}${separator}${valueQuote}${REDACTED}${valueQuote}`;
    })
    .replace(/\b(api_key|apiKey)(\s*[:=]\s*)(\\?["']?)([^\\"',}\s]+)(\\?["']?)/g, (_match, key, separator, openQuote, _value, closeQuote) => {
      return `${key}${separator}${openQuote}${REDACTED}${closeQuote}`;
    });
}
