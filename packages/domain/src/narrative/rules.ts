export interface AbilityCost {
  kind: string;
  quantity: number;
  unit: string;
}

export interface PowerSystemRule {
  id: string;
  projectId: string;
  powerId: string;
  title: string;
  statement: string;
  requiredCosts: AbilityCost[];
  limits: unknown[];
}

export function createPowerSystemRule(input: Omit<PowerSystemRule, 'id'>): PowerSystemRule {
  return { id: `world_rule_${crypto.randomUUID().replace(/-/g, '')}`, ...input };
}

export function validatePowerUse(
  rule: PowerSystemRule,
  input: { powerId: string; actorId: string; paidCosts: AbilityCost[] }
): {
  accepted: boolean;
  violations: Array<{ code: string; ruleId: string; message: string; requiredCost: AbilityCost }>;
} {
  const violations = rule.requiredCosts
    .filter(
      (required) =>
        !input.paidCosts.some(
          (paid) => paid.kind === required.kind && paid.quantity >= required.quantity && paid.unit === required.unit
        )
    )
    .map((requiredCost) => ({
      code: 'missing_required_cost',
      ruleId: rule.id,
      message: `Power ${rule.powerId} requires ${requiredCost.quantity} ${requiredCost.unit} of ${requiredCost.kind}`,
      requiredCost
    }));

  return { accepted: violations.length === 0, violations };
}

export function createRuleException(input: {
  projectId: string;
  ruleId: string;
  description: string;
  rationale: string;
  requestedBy: string;
}) {
  const id = `rule_exception_${crypto.randomUUID().replace(/-/g, '')}`;
  return {
    id,
    ...input,
    status: 'PendingApproval',
    approvalSignal: {
      targetType: 'RuleException',
      targetId: id,
      riskLevel: 'High',
      status: 'Pending',
      reason: `Rule exception requires high-risk approval: ${input.description}`
    }
  };
}
