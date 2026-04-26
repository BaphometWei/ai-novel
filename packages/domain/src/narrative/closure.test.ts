import { describe, expect, it } from 'vitest';
import { createClosureChecklist } from './closure';

describe('Closure checklist', () => {
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
        label: 'Resolve Core promise: Reveal why the city remembers the old war.'
      },
      {
        sourceType: 'CharacterArc',
        sourceId: 'character_arc_major',
        severity: 'Blocking',
        label: 'Close major character arc: Mai must choose whether power is worth isolation.'
      }
    ]);
  });
});
