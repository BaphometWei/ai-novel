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
  taskTypes: string[];
}

export function defineAgentRoles(): AgentRoleDefinition[] {
  return [
    role('Chief Editor', 'editorial_brief', 'EditorialBrief', 'decision_support', [
      'editorial_brief',
      'general_agent_task'
    ]),
    role('Planner', 'plot_plan', 'PlotPlan', 'decision_support', ['chapter_planning', 'plot_planning']),
    role('Lore Keeper', 'canon_patch', 'CanonPatch', 'memory_candidate', ['canon_patch', 'worldbuilding']),
    role('Writer', 'draft_prose', 'DraftProse', 'agent_draft_until_author_acceptance', ['writing_draft']),
    role('Editor', 'revision_suggestion', 'RevisionSuggestion', 'decision_support', ['revision', 'line_edit']),
    role('Continuity Sentinel', 'continuity_report', 'ContinuityReport', 'decision_support', ['continuity_review']),
    role('Voice Director', 'voice_report', 'VoiceReport', 'analysis_only', ['voice_review']),
    role('Research', 'research_note', 'ResearchNote', 'analysis_only', ['research']),
    role('Market Analyst', 'market_report', 'MarketReport', 'analysis_only', ['market_analysis']),
    role('Serialization', 'serialization_plan', 'SerializationPlan', 'decision_support', ['serialization_plan']),
    role('Memory Curator', 'memory_decision', 'MemoryDecision', 'memory_candidate', ['memory_curation'])
  ];
}

export function assertAgentCanRunTask(agentRole: string, taskType: string): void {
  const roleDefinition = defineAgentRoles().find((role) => role.name === agentRole);
  if (!roleDefinition) {
    throw new Error(`Unknown agent role: ${agentRole}`);
  }
  if (!roleDefinition.taskTypes.includes(taskType)) {
    throw new Error(`Agent role ${agentRole} cannot run task type ${taskType}`);
  }
}

function role(
  name: AgentRoleName,
  type: string,
  schemaName: string,
  ownership: AgentArtifactContract['ownership'],
  taskTypes: string[]
): AgentRoleDefinition {
  return {
    name,
    outputArtifact: {
      type,
      schemaName,
      ownership
    },
    taskTypes
  };
}
