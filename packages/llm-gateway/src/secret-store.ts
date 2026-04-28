export interface ProviderSecretStore {
  resolve(secretRef: string): string | undefined;
}

export function createEnvSecretStore(env: Record<string, string | undefined>): ProviderSecretStore {
  return {
    resolve(secretRef) {
      if (!secretRef.startsWith('env:')) {
        throw new Error(`Unsupported provider secret reference: ${secretRef}`);
      }

      return env[secretRef.slice('env:'.length)];
    }
  };
}
