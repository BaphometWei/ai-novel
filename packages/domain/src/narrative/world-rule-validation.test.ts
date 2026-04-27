import { describe, expect, it } from 'vitest';
import { validateWorldRuleUse } from './world-rule-validation';

describe('world-rule validation', () => {
  it('rejects power use when required cost, cooldown, resource, counter-rule, and progression constraints are missing', () => {
    const result = validateWorldRuleUse({
      use: {
        powerId: 'power_shadow_step',
        actorId: 'character_mai',
        usedAt: '2026-04-27T09:20:00.000Z',
        paidCosts: [],
        resources: { shadow_charge: 1 },
        progression: { shadow_rank: 1 },
        acknowledgedCounterRuleIds: []
      },
      rules: [
        {
          id: 'world_rule_shadow_step',
          projectId: 'project_abc',
          powerId: 'power_shadow_step',
          title: 'Shadow Step constraints',
          statement: 'Shadow Step burns vitality, needs charge, and cannot pierce wards.',
          requiredCosts: [{ kind: 'vitality', quantity: 2, unit: 'points' }],
          cooldownMinutes: 60,
          requiredResources: [{ kind: 'shadow_charge', quantity: 2, unit: 'charges' }],
          counterRuleIds: ['world_rule_warded_rooms_block_shadow'],
          progressionRequirements: [{ track: 'shadow_rank', minimumLevel: 3 }],
          limits: []
        }
      ],
      priorUses: [
        {
          powerId: 'power_shadow_step',
          actorId: 'character_mai',
          usedAt: '2026-04-27T08:45:00.000Z'
        }
      ]
    });

    expect(result.accepted).toBe(false);
    expect(result.violations).toEqual([
      {
        type: 'missing_required_cost',
        severity: 'Blocking',
        ruleId: 'world_rule_shadow_step',
        evidence: 'Power power_shadow_step requires 2 points of vitality.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      },
      {
        type: 'cooldown_not_elapsed',
        severity: 'High',
        ruleId: 'world_rule_shadow_step',
        evidence: 'character_mai used power_shadow_step 35 minutes ago; cooldown is 60 minutes.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      },
      {
        type: 'insufficient_resource',
        severity: 'Blocking',
        ruleId: 'world_rule_shadow_step',
        evidence: 'Power power_shadow_step requires 2 charges of shadow_charge, but character_mai has 1.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      },
      {
        type: 'counter_rule_unresolved',
        severity: 'High',
        ruleId: 'world_rule_shadow_step',
        evidence: 'Power power_shadow_step must address counter-rule world_rule_warded_rooms_block_shadow.',
        confidence: 0.9,
        falsePositiveTolerance: 'Medium'
      },
      {
        type: 'progression_requirement_missing',
        severity: 'Blocking',
        ruleId: 'world_rule_shadow_step',
        evidence: 'Power power_shadow_step requires shadow_rank level 3, but character_mai has level 1.',
        confidence: 1,
        falsePositiveTolerance: 'Low'
      }
    ]);
  });
});
