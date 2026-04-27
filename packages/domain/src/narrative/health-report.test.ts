import { describe, expect, it } from 'vitest';
import { createNarrativeHealthReport } from './health-report';
import { createReaderPromiseFromDetection } from './promises';
import { createSecret, createKnowledgeState } from './secrets';
import { createRelationshipState } from './arcs';
import { createPowerSystemRule } from './rules';

describe('createNarrativeHealthReport', () => {
  it('aggregates narrative intelligence signals into an inspectable report', () => {
    const { promise } = createReaderPromiseFromDetection({
      projectId: 'project_abc',
      title: 'The bell must pay off',
      level: 'MainPlot',
      strength: 'Core',
      surfaceClue: 'The bell is mentioned everywhere.',
      hiddenQuestion: 'What does the bell control?',
      readerExpectation: 'The bell matters to the ending.',
      firstAppearance: { chapterId: 'chapter_1', chapterNumber: 1 },
      relatedEntities: [{ type: 'Character', id: 'character_a' }],
      payoffWindow: { startChapter: 2, endChapter: 4 },
      sourceRunId: 'agent_run_1',
      detectionConfidence: 0.95
    });

    const report = createNarrativeHealthReport({
      projectId: 'project_abc',
      currentChapter: 3,
      readerPromises: [{ ...promise, status: 'Active' }],
      secrets: [
        createSecret({
          id: 'secret_1',
          projectId: 'project_abc',
          title: 'The bell is alive',
          hiddenTruth: 'The bell is alive',
          status: 'Hidden'
        })
      ],
      knowledgeStates: [createKnowledgeState({ secretId: 'secret_1' })],
      revealEvents: [
        {
          id: 'reveal_1',
          secretId: 'secret_1',
          chapter: 3,
          readerReveal: { state: 'Knows' }
        }
      ],
      relationships: [
        createRelationshipState({
          characterId: 'character_a',
          counterpartId: 'character_b',
          disposition: 'Hostile',
          source: { type: 'scene', id: 'scene_1' }
        })
      ],
      relationshipTurningPoints: [
        {
          eventId: 'scene_rescue',
          description: 'Character B saves Character A.',
          source: { type: 'scene', id: 'scene_rescue' }
        }
      ],
      timelineLinks: [
        {
          cause: { eventId: 'scene_alarm', occursAt: '2026-04-27T10:00:00.000Z' },
          effect: { eventId: 'scene_response', occursAt: '2026-04-27T10:05:00.000Z' },
          description: 'Alarm triggers response'
        }
      ],
      appearances: [
        {
          eventId: 'scene_walk',
          characterIds: ['character_a'],
          locationId: 'location_a',
          startsAt: '2026-04-27T09:00:00.000Z',
          endsAt: '2026-04-27T09:30:00.000Z'
        },
        {
          eventId: 'scene_arrival',
          characterIds: ['character_a'],
          locationId: 'location_b',
          startsAt: '2026-04-27T11:00:00.000Z'
        }
      ],
      travelDurations: [
        {
          fromLocationId: 'location_a',
          toLocationId: 'location_b',
          minimumDurationMinutes: 60
        }
      ],
      powerRules: [
        {
          rule: createPowerSystemRule({
            projectId: 'project_abc',
            powerId: 'power_bell',
            title: 'Bell power costs memory',
            statement: 'Bell power requires memory cost.',
            requiredCosts: [{ kind: 'memory', quantity: 1, unit: 'mark' }],
            limits: []
          }),
          powerId: 'power_bell',
          actorId: 'character_a',
          paidCosts: [],
          requestRuleException: true,
          exception: {
            description: 'Allow one free use for the climax.',
            rationale: 'The final reveal needs an exception.',
            requestedBy: 'user'
          }
        }
      ]
    });

    expect(report.promiseStates[0]).toMatchObject({ uiState: 'ReadyForPayoff', health: 'ReadyForPayoff' });
    expect(report.revealStates[0]).toEqual({ secretId: 'secret_1', readerKnowledge: 'Knows' });
    expect(report.relationshipStates[0]).toMatchObject({ disposition: 'Loyal', turningPoints: 1 });
    expect(report.timelineIssues).toEqual([]);
    expect(report.ruleIssues[0]).toContain('Power power_bell requires 1 mark of memory');
    expect(report.closureChecklist.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceType: 'ReaderPromise' })])
    );
    expect(report.approvalSignals[0]).toMatchObject({ targetType: 'RuleException', riskLevel: 'High' });
  });
});
