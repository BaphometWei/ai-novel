export type PromptVersionStatus = 'Draft' | 'Active' | 'Deprecated';

export interface PromptVersionDefinition {
  id: string;
  taskType: string;
  template: string;
  model: string;
  provider: string;
  version: number;
  status: PromptVersionStatus;
}

export interface PromptRegistry {
  resolve(id: string): PromptVersionDefinition;
  list(): PromptVersionDefinition[];
}

export function createPromptRegistry(definitions: PromptVersionDefinition[]): PromptRegistry {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  return {
    resolve(id: string) {
      const definition = byId.get(id);
      if (!definition) throw new Error(`PromptVersion not found: ${id}`);
      return definition;
    },
    list() {
      return [...definitions];
    }
  };
}
