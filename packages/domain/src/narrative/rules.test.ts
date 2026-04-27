import { describe, expect, it } from 'vitest';
import { createPowerSystemRule, createRuleException, validatePowerUse } from './rules';

describe('World rules and power constraints', () => {
  it('fails a power use when the required cost is missing', () => {
    const rule = createPowerSystemRule({
      projectId: 'project_abc',
      powerId: 'power_shadow_step',
      title: 'Shadow Step requires vitality',
      statement: 'Shadow Step consumes vitality every time it is used.',
      requiredCosts: [{ kind: 'vitality', quantity: 2, unit: 'points' }],
      limits: []
    });

    const result = validatePowerUse(rule, {
      powerId: 'power_shadow_step',
      actorId: 'character_mai',
      paidCosts: []
    });

    expect(result.accepted).toBe(false);
    expect(result.violations).toEqual([
      {
        code: 'missing_required_cost',
        ruleId: rule.id,
        message: 'Power power_shadow_step requires 2 points of vitality',
        requiredCost: { kind: 'vitality', quantity: 2, unit: 'points' }
      }
    ]);
  });

  it('requires a high-risk approval signal for a new rule exception', () => {
    const exception = createRuleException({
      projectId: 'project_abc',
      ruleId: 'world_rule_no_resurrection',
      description: 'Allow one resurrection during the eclipse.',
      rationale: 'The finale needs a one-time exception with reader-visible cost.',
      requestedBy: 'user'
    });

    expect(exception.status).toBe('PendingApproval');
    expect(exception.approvalSignal).toMatchObject({
      targetType: 'RuleException',
      targetId: exception.id,
      riskLevel: 'High',
      status: 'Pending',
      reason: 'Rule exception requires high-risk approval: Allow one resurrection during the eclipse.'
    });
  });
});
