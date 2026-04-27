import { describe, expect, it } from 'vitest';
import { createClosureChecklist, createFinalPayoffPlan, shouldRunClosureChecks } from './closure';

describe('Closure checklist', () => {
  it('adds risk and status for unresolved Core promises and major character arcs', () => {
    const checklist = createClosureChecklist({
      projectId: 'project_abc',
      promises: [
        {
          id: 'reader_promise_core',
          importance: 'Core',
          status: 'Active',
          summary: 'Reveal why the city remembers the old war.',
          payoffWindow: { startChapter: 20, endChapter: 22 },
          currentChapter: 23
        },
        {
          id: 'reader_promise_major',
          importance: 'Major',
          status: 'Active',
          summary: 'Explain the captain oath.'
        }
      ],
      characterArcs: [
        {
          id: 'character_arc_major',
          characterId: 'character_mai',
          importance: 'Major',
          status: 'Unresolved',
          summary: 'Mai must choose whether power is worth isolation.',
          currentChapter: 23,
          targetChapter: 24
        }
      ]
    });

    expect(checklist.items).toEqual([
      {
        sourceType: 'ReaderPromise',
        sourceId: 'reader_promise_core',
        severity: 'Blocking',
        risk: 'Overdue',
        status: 'NeedsResolution',
        label: 'Resolve Core promise: Reveal why the city remembers the old war.'
      },
      {
        sourceType: 'CharacterArc',
        sourceId: 'character_arc_major',
        severity: 'Blocking',
        risk: 'DueSoon',
        status: 'NeedsResolution',
        label: 'Close major character arc: Mai must choose whether power is worth isolation.'
      }
    ]);
  });

  it('includes unresolved Core promises and major character arcs', () => {
    const checklist = createClosureChecklist({
      projectId: 'project_abc',
      promises: [
        {
          id: 'reader_promise_core',
          importance: 'Core',
          status: 'Open',
          summary: 'Reveal why the city remembers the old war.'
        },
        {
          id: 'reader_promise_minor',
          importance: 'Side',
          status: 'Open',
          summary: 'Explain the missing bakery sign.'
        }
      ],
      characterArcs: [
        {
          id: 'character_arc_major',
          characterId: 'character_mai',
          importance: 'Major',
          status: 'Unresolved',
          summary: 'Mai must choose whether power is worth isolation.'
        },
        {
          id: 'character_arc_resolved',
          characterId: 'character_ren',
          importance: 'Major',
          status: 'Closed',
          summary: 'Ren accepts the cost of leadership.'
        }
      ]
    });

    expect(checklist.items).toEqual([
      {
        sourceType: 'ReaderPromise',
        sourceId: 'reader_promise_core',
        severity: 'Blocking',
        risk: 'Open',
        status: 'NeedsResolution',
        label: 'Resolve Core promise: Reveal why the city remembers the old war.'
      },
      {
        sourceType: 'CharacterArc',
        sourceId: 'character_arc_major',
        severity: 'Blocking',
        risk: 'Open',
        status: 'NeedsResolution',
        label: 'Close major character arc: Mai must choose whether power is worth isolation.'
      }
    ]);
  });
});

describe('Final payoff plan', () => {
  it('plans ending closure across final payoff domains and reports unresolved blockers', () => {
    const plan = createFinalPayoffPlan({
      projectId: 'project_abc',
      plotlines: [
        {
          id: 'plotline_main',
          title: 'The drowned city succession',
          importance: 'Core',
          status: 'Unresolved',
          finalPayoff: 'The rightful heir chooses whether to restore the drowned court.'
        }
      ],
      characterArcs: [
        {
          id: 'arc_mai',
          characterId: 'character_mai',
          importance: 'Major',
          status: 'Resolving',
          summary: 'Mai accepts leadership without isolation.',
          finalState: 'Chooses mutual rule.'
        }
      ],
      readerPromises: [
        {
          id: 'promise_bell',
          strength: 'Core',
          status: 'Active',
          title: 'The drowned bell must be answered',
          payoff: 'The bell names the founder who betrayed the city.'
        }
      ],
      secrets: [
        {
          id: 'secret_heir',
          status: 'Hidden',
          title: 'Mai is the lost heir',
          plannedReveal: 'Revealed during the coronation challenge.',
          evidenceSupported: false
        }
      ],
      worldRules: [
        {
          id: 'rule_resurrection_cost',
          title: 'Resurrection costs a remembered name',
          consequenceStatus: 'Broken',
          expectedConsequence: 'Mai must lose one public identity.'
        }
      ],
      antagonistOutcome: {
        antagonistId: 'character_regent',
        status: 'Missing',
        expectedOutcome: 'The regent faces public judgment.'
      },
      readerContract: {
        status: 'AtRisk',
        expectation: 'No twist should erase earned character choices.'
      },
      openQuestions: [
        {
          id: 'question_bell_origin',
          question: 'Who first drowned the bell?',
          decision: 'Answer'
        }
      ]
    });

    expect(plan.items).toEqual([
      {
        sourceType: 'Plotline',
        sourceId: 'plotline_main',
        status: 'NeedsPayoff',
        severity: 'Blocking',
        label: 'Pay off plotline: The drowned city succession',
        recommendation: 'The rightful heir chooses whether to restore the drowned court.'
      },
      {
        sourceType: 'CharacterArc',
        sourceId: 'arc_mai',
        status: 'NeedsClosure',
        severity: 'High',
        label: 'Close character arc: Mai accepts leadership without isolation.',
        recommendation: 'Chooses mutual rule.'
      },
      {
        sourceType: 'ReaderPromise',
        sourceId: 'promise_bell',
        status: 'NeedsPayoff',
        severity: 'Blocking',
        label: 'Pay off Core promise: The drowned bell must be answered',
        recommendation: 'The bell names the founder who betrayed the city.'
      },
      {
        sourceType: 'Secret',
        sourceId: 'secret_heir',
        status: 'NeedsRevealSupport',
        severity: 'Blocking',
        label: 'Support final reveal: Mai is the lost heir',
        recommendation: 'Revealed during the coronation challenge.'
      },
      {
        sourceType: 'WorldRule',
        sourceId: 'rule_resurrection_cost',
        status: 'NeedsConsequence',
        severity: 'Blocking',
        label: 'Restore world-rule consequence: Resurrection costs a remembered name',
        recommendation: 'Mai must lose one public identity.'
      },
      {
        sourceType: 'AntagonistOutcome',
        sourceId: 'character_regent',
        status: 'MissingOutcome',
        severity: 'Blocking',
        label: 'Resolve antagonist outcome: character_regent',
        recommendation: 'The regent faces public judgment.'
      },
      {
        sourceType: 'ReaderContract',
        sourceId: 'reader_contract',
        status: 'AtRisk',
        severity: 'High',
        label: 'Honor reader contract',
        recommendation: 'No twist should erase earned character choices.'
      },
      {
        sourceType: 'OpenQuestion',
        sourceId: 'question_bell_origin',
        status: 'DecisionRecorded',
        severity: 'Medium',
        label: 'Answer open question: Who first drowned the bell?',
        recommendation: 'Answer'
      }
    ]);
    expect(plan.blockers).toEqual([
      'Core plotline plotline_main still needs final payoff.',
      'Core reader promise promise_bell is unresolved.',
      'Secret secret_heir reveal lacks supporting evidence.',
      'World rule rule_resurrection_cost has a broken final consequence.',
      'Antagonist outcome is missing for character_regent.'
    ]);
    expect(plan.recommendations).toContain('Resolve blocking closure items before drafting the final ending.');
  });

  it('does not add blockers for resolved ending material with recorded open-question decisions', () => {
    const plan = createFinalPayoffPlan({
      projectId: 'project_abc',
      plotlines: [{ id: 'plotline_main', title: 'Succession', importance: 'Core', status: 'Resolved' }],
      characterArcs: [{ id: 'arc_mai', characterId: 'mai', importance: 'Major', status: 'Closed', summary: 'Mai chooses.' }],
      readerPromises: [{ id: 'promise_bell', strength: 'Core', status: 'Fulfilled', title: 'Bell truth' }],
      secrets: [{ id: 'secret_heir', status: 'Revealed', title: 'Heir truth', evidenceSupported: true }],
      worldRules: [{ id: 'rule_cost', title: 'Magic has cost', consequenceStatus: 'Honored' }],
      antagonistOutcome: { antagonistId: 'regent', status: 'Resolved' },
      readerContract: { status: 'Honored', expectation: 'Choices matter.' },
      openQuestions: [{ id: 'question_epilogue', question: 'What happens to the archive?', decision: 'LeaveOpen' }]
    });

    expect(plan.blockers).toEqual([]);
    expect(plan.items).toEqual([
      {
        sourceType: 'OpenQuestion',
        sourceId: 'question_epilogue',
        status: 'DecisionRecorded',
        severity: 'Medium',
        label: 'Leave open question: What happens to the archive?',
        recommendation: 'LeaveOpen'
      }
    ]);
  });
});

describe('Closure check activation', () => {
  it('runs for final volume, explicit ending planning, or major arcs near resolution', () => {
    expect(shouldRunClosureChecks({ isFinalVolume: true })).toBe(true);
    expect(shouldRunClosureChecks({ requestType: 'EndingPlanning' })).toBe(true);
    expect(
      shouldRunClosureChecks({
        majorArcs: [{ id: 'arc_mai', status: 'Resolving', progressToResolution: 0.82 }]
      })
    ).toBe(true);
  });

  it('stays off before ending pressure appears', () => {
    expect(
      shouldRunClosureChecks({
        isFinalVolume: false,
        requestType: 'DraftChapter',
        majorArcs: [{ id: 'arc_mai', status: 'Active', progressToResolution: 0.4 }]
      })
    ).toBe(false);
  });
});
