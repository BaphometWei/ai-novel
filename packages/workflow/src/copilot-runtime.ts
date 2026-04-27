export type InitiativeLevel = 'quiet' | 'collaborative' | 'director';
export type ExecutionDepth = 'quick' | 'standard' | 'deep';
export type VisibilityLevel = 'compact' | 'full' | 'expert';
export type RuntimeRiskLevel = 'Low' | 'Medium' | 'High' | 'Blocking';

export interface CopilotRuntimePolicy {
  initiative: InitiativeLevel;
  executionDepth: ExecutionDepth;
  visibility: VisibilityLevel;
  attentionBudget: number;
}

export interface RuntimeEvent {
  type: string;
  riskLevel: RuntimeRiskLevel;
  message: string;
}

export interface RuntimeDecision {
  visible: boolean;
  route: 'log' | 'side_panel' | 'decision_queue';
}

export function evaluateRuntimeEvent(policy: CopilotRuntimePolicy, event: RuntimeEvent): RuntimeDecision {
  if (event.riskLevel === 'High' || event.riskLevel === 'Blocking') {
    return { visible: true, route: 'decision_queue' };
  }

  if (policy.initiative === 'quiet' && event.riskLevel === 'Low') {
    return { visible: false, route: 'log' };
  }

  return { visible: true, route: 'side_panel' };
}
