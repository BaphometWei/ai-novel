import type { AbilityCost, PowerSystemRule } from './rules';

export type WorldRuleViolationType =
  | 'missing_required_cost'
  | 'cooldown_not_elapsed'
  | 'insufficient_resource'
  | 'counter_rule_unresolved'
  | 'progression_requirement_missing';
export type WorldRuleViolationSeverity = 'High' | 'Blocking';
export type FalsePositiveTolerance = 'Low' | 'Medium' | 'High';

export interface PowerUseRecord {
  powerId: string;
  actorId: string;
  usedAt: string;
}

export interface WorldRuleUseInput {
  powerId: string;
  actorId: string;
  usedAt: string;
  paidCosts: AbilityCost[];
  resources?: Record<string, number>;
  progression?: Record<string, number>;
  acknowledgedCounterRuleIds?: string[];
}

export interface WorldRuleViolation {
  type: WorldRuleViolationType;
  severity: WorldRuleViolationSeverity;
  ruleId: string;
  evidence: string;
  confidence: number;
  falsePositiveTolerance: FalsePositiveTolerance;
}

export interface WorldRuleValidationResult {
  accepted: boolean;
  violations: WorldRuleViolation[];
}

export function validateWorldRuleUse(input: {
  rules: PowerSystemRule[];
  use: WorldRuleUseInput;
  priorUses?: PowerUseRecord[];
}): WorldRuleValidationResult {
  const rules = input.rules
    .filter((rule) => rule.powerId === input.use.powerId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const violations = rules.flatMap((rule) => validateRule(rule, input.use, input.priorUses ?? []));

  violations.sort((left, right) => violationRank(left.type) - violationRank(right.type) || left.ruleId.localeCompare(right.ruleId));
  return { accepted: violations.length === 0, violations };
}

function validateRule(rule: PowerSystemRule, use: WorldRuleUseInput, priorUses: PowerUseRecord[]): WorldRuleViolation[] {
  const violations: WorldRuleViolation[] = [];

  for (const requiredCost of rule.requiredCosts) {
    const paid = use.paidCosts.find((cost) => cost.kind === requiredCost.kind && cost.unit === requiredCost.unit);
    if (!paid || paid.quantity < requiredCost.quantity) {
      violations.push({
        type: 'missing_required_cost',
        severity: 'Blocking',
        ruleId: rule.id,
        evidence: `Power ${rule.powerId} requires ${requiredCost.quantity} ${requiredCost.unit} of ${requiredCost.kind}.`,
        confidence: 1,
        falsePositiveTolerance: 'Low'
      });
    }
  }

  if (rule.cooldownMinutes !== undefined) {
    const lastUse = [...priorUses]
      .filter((record) => record.powerId === use.powerId && record.actorId === use.actorId)
      .sort((left, right) => Date.parse(right.usedAt) - Date.parse(left.usedAt))[0];

    if (lastUse) {
      const elapsedMinutes = Math.floor((Date.parse(use.usedAt) - Date.parse(lastUse.usedAt)) / 60000);
      if (elapsedMinutes < rule.cooldownMinutes) {
        violations.push({
          type: 'cooldown_not_elapsed',
          severity: 'High',
          ruleId: rule.id,
          evidence: `${use.actorId} used ${use.powerId} ${elapsedMinutes} minutes ago; cooldown is ${rule.cooldownMinutes} minutes.`,
          confidence: 1,
          falsePositiveTolerance: 'Low'
        });
      }
    }
  }

  for (const requiredResource of rule.requiredResources ?? []) {
    const available = use.resources?.[requiredResource.kind] ?? 0;
    if (available < requiredResource.quantity) {
      violations.push({
        type: 'insufficient_resource',
        severity: 'Blocking',
        ruleId: rule.id,
        evidence: `Power ${rule.powerId} requires ${requiredResource.quantity} ${requiredResource.unit} of ${requiredResource.kind}, but ${use.actorId} has ${available}.`,
        confidence: 1,
        falsePositiveTolerance: 'Low'
      });
    }
  }

  for (const counterRuleId of rule.counterRuleIds ?? []) {
    if (!(use.acknowledgedCounterRuleIds ?? []).includes(counterRuleId)) {
      violations.push({
        type: 'counter_rule_unresolved',
        severity: 'High',
        ruleId: rule.id,
        evidence: `Power ${rule.powerId} must address counter-rule ${counterRuleId}.`,
        confidence: 0.9,
        falsePositiveTolerance: 'Medium'
      });
    }
  }

  for (const requirement of rule.progressionRequirements ?? []) {
    const level = use.progression?.[requirement.track] ?? 0;
    if (level < requirement.minimumLevel) {
      violations.push({
        type: 'progression_requirement_missing',
        severity: 'Blocking',
        ruleId: rule.id,
        evidence: `Power ${rule.powerId} requires ${requirement.track} level ${requirement.minimumLevel}, but ${use.actorId} has level ${level}.`,
        confidence: 1,
        falsePositiveTolerance: 'Low'
      });
    }
  }

  return violations;
}

function violationRank(type: WorldRuleViolationType): number {
  return [
    'missing_required_cost',
    'cooldown_not_elapsed',
    'insufficient_resource',
    'counter_rule_unresolved',
    'progression_requirement_missing'
  ].indexOf(type);
}
