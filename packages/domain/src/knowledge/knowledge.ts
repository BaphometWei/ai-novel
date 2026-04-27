export type SourceUse = 'analysis' | 'structure' | 'style_parameters' | 'generation_support';
export type KnowledgeKind =
  | 'IdeaItem'
  | 'QuickCapture'
  | 'Material'
  | 'Sample'
  | 'Trope'
  | 'Technique'
  | 'GenreRule'
  | 'ScenePattern'
  | 'CharacterTemplate'
  | 'WorldTemplate'
  | 'StyleProfile'
  | 'ReviewRule'
  | 'AntiPattern'
  | 'StyleExperiment';
export type KnowledgeLifecycleStatus = 'Candidate' | 'Active' | 'Archived';

export interface SourcePolicy {
  id: string;
  sourceType: 'original' | 'user_note' | 'licensed' | 'public_domain' | 'web_excerpt' | 'agent_summary';
  allowedUse: SourceUse[];
  prohibitedUse: SourceUse[];
  attributionRequirements: string;
  licenseNotes: string;
  similarityRisk: 'Low' | 'Medium' | 'High';
}

export interface Tag {
  id: string;
  label: string;
}

export interface EmbeddingRecord {
  id: string;
  model: string;
  vectorHash: string;
}

export interface KnowledgeMaterial {
  sourceTitle: string;
  sourcePolicy: SourcePolicy;
  extractedSummary: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  kind: KnowledgeKind;
  lifecycleStatus: KnowledgeLifecycleStatus;
  material: KnowledgeMaterial;
  tags: string[];
  embeddings: EmbeddingRecord[];
}

export type IdeaItem = KnowledgeItem & { kind: 'IdeaItem' };
export type QuickCapture = KnowledgeItem & { kind: 'QuickCapture' };
export type Material = KnowledgeItem & { kind: 'Material' };
export type Sample = KnowledgeItem & { kind: 'Sample' };
export type Trope = KnowledgeItem & { kind: 'Trope' };
export type Technique = KnowledgeItem & { kind: 'Technique' };
export type GenreRule = KnowledgeItem & { kind: 'GenreRule' };
export type ScenePattern = KnowledgeItem & { kind: 'ScenePattern' };
export type CharacterTemplate = KnowledgeItem & { kind: 'CharacterTemplate' };
export type WorldTemplate = KnowledgeItem & { kind: 'WorldTemplate' };
export type StyleProfile = KnowledgeItem & { kind: 'StyleProfile' };
export type ReviewRule = KnowledgeItem & { kind: 'ReviewRule' };
export type AntiPattern = KnowledgeItem & { kind: 'AntiPattern' };
export type StyleExperiment = KnowledgeItem & { kind: 'StyleExperiment' };

export interface SourceContextExclusion {
  knowledgeItemId: string;
  reason: string;
}

export interface GenerationSourceContext {
  included: KnowledgeItem[];
  exclusions: SourceContextExclusion[];
}

export function createSourcePolicy(input: Omit<SourcePolicy, 'id'>): SourcePolicy {
  return {
    id: `source_policy_${crypto.randomUUID().replace(/-/g, '')}`,
    ...input
  };
}

export function canUseSourceFor(policy: SourcePolicy, use: SourceUse): boolean {
  return policy.allowedUse.includes(use) && !policy.prohibitedUse.includes(use);
}

export function createKnowledgeItem(input: Omit<KnowledgeItem, 'id' | 'embeddings'> & { embeddings?: EmbeddingRecord[] }): KnowledgeItem {
  return {
    id: `knowledge_item_${crypto.randomUUID().replace(/-/g, '')}`,
    embeddings: input.embeddings ?? [],
    ...input
  };
}

export function buildGenerationSourceContext(items: KnowledgeItem[]): GenerationSourceContext {
  const included: KnowledgeItem[] = [];
  const exclusions: SourceContextExclusion[] = [];

  for (const item of items) {
    if (item.lifecycleStatus !== 'Active') {
      exclusions.push({ knowledgeItemId: item.id, reason: 'Knowledge item is not active' });
      continue;
    }

    if (!canUseSourceFor(item.material.sourcePolicy, 'generation_support')) {
      exclusions.push({ knowledgeItemId: item.id, reason: 'Source policy prohibits generation support' });
      continue;
    }

    included.push(item);
  }

  return { included, exclusions };
}
