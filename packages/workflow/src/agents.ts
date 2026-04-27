export type AgentRoleName =
  | 'Chief Editor'
  | 'Planner'
  | 'Lore Keeper'
  | 'Writer'
  | 'Editor'
  | 'Continuity Sentinel'
  | 'Voice Director'
  | 'Research'
  | 'Market Analyst'
  | 'Serialization'
  | 'Memory Curator';

export interface AgentArtifactContract {
  type: string;
  schemaName: string;
  ownership: 'agent_draft_until_author_acceptance' | 'decision_support' | 'memory_candidate' | 'analysis_only';
}

export interface AgentRoleDefinition {
  name: AgentRoleName;
  outputArtifact: AgentArtifactContract;
}

export function defineAgentRoles(): AgentRoleDefinition[] {
  return [
    role('Chief Editor', 'editorial_brief', 'EditorialBrief', 'decision_support'),
    role('Planner', 'plot_plan', 'PlotPlan', 'decision_support'),
    role('Lore Keeper', 'canon_patch', 'CanonPatch', 'memory_candidate'),
    role('Writer', 'draft_prose', 'DraftProse', 'agent_draft_until_author_acceptance'),
    role('Editor', 'revision_suggestion', 'RevisionSuggestion', 'decision_support'),
    role('Continuity Sentinel', 'continuity_report', 'ContinuityReport', 'decision_support'),
    role('Voice Director', 'voice_report', 'VoiceReport', 'analysis_only'),
    role('Research', 'research_note', 'ResearchNote', 'analysis_only'),
    role('Market Analyst', 'market_report', 'MarketReport', 'analysis_only'),
    role('Serialization', 'serialization_plan', 'SerializationPlan', 'decision_support'),
    role('Memory Curator', 'memory_decision', 'MemoryDecision', 'memory_candidate')
  ];
}

function role(
  name: AgentRoleName,
  type: string,
  schemaName: string,
  ownership: AgentArtifactContract['ownership']
): AgentRoleDefinition {
  return {
    name,
    outputArtifact: {
      type,
      schemaName,
      ownership
    }
  };
}
