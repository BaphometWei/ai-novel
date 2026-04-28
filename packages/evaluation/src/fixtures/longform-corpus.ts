import type { EvaluateRetrievalRegressionInput, RetrievalRegressionItem } from '../retrieval-regression';

export interface LongformRetrievalCorpus {
  projectId: string;
  policy: { id: string; description: string };
  canonFacts: RetrievalRegressionItem[];
  forbiddenSourceSamples: RetrievalRegressionItem[];
  promises: RetrievalRegressionItem[];
  secrets: RetrievalRegressionItem[];
  regressionCases: EvaluateRetrievalRegressionInput[];
}

export const longformRetrievalCorpus: LongformRetrievalCorpus = {
  projectId: 'project_longform_fixture',
  policy: {
    id: 'policy_longform_triage_v1',
    description: 'Prioritize accepted canon and promise continuity while excluding restricted prose samples.'
  },
  canonFacts: [
    {
      id: 'canon_lyra_vow_clocktower',
      text: 'Lyra vowed at the clocktower to return the silver weatherglass before the regent opens the harbor gates.'
    },
    {
      id: 'canon_marrek_debt',
      text: 'Marrek owes the lighthouse guild three favors after hiding the false heir in the storm cellar.'
    }
  ],
  forbiddenSourceSamples: [
    {
      id: 'sample_banned_duelist_voice',
      text: 'A restricted duelist sample uses clipped second-person taunts and must never enter generated context.'
    },
    {
      id: 'sample_private_letter_cadence',
      text: 'A private commissioned letter sample has a barred cadence and cannot be used as style evidence.'
    }
  ],
  promises: [
    {
      id: 'promise_silver_weatherglass',
      text: 'Readers were promised that the silver weatherglass will reveal which harbor bell lies.'
    },
    {
      id: 'promise_lighthouse_trial',
      text: 'The lighthouse trial must resolve whether Marrek betrayed Lyra or protected the false heir.'
    }
  ],
  secrets: [
    {
      id: 'secret_heir_false_name',
      text: 'The false heir travels under the name Corin Vale until the regent sees the hidden birthmark.'
    },
    {
      id: 'secret_harbor_bell',
      text: 'The cracked east bell rings only when a witness is lying about the harbor fire.'
    }
  ],
  regressionCases: [
    {
      caseId: 'longform_clocktower_vow_recall',
      projectId: 'project_longform_fixture',
      query: 'What must Lyra remember before the harbor gates open?',
      policy: {
        id: 'policy_longform_triage_v1',
        description: 'Prioritize accepted canon and promise continuity while excluding restricted prose samples.'
      },
      mustInclude: [
        {
          id: 'canon_lyra_vow_clocktower',
          text: 'Lyra vowed at the clocktower to return the silver weatherglass before the regent opens the harbor gates.'
        },
        {
          id: 'promise_silver_weatherglass',
          text: 'Readers were promised that the silver weatherglass will reveal which harbor bell lies.'
        }
      ],
      forbidden: [
        {
          id: 'sample_banned_duelist_voice',
          text: 'A restricted duelist sample uses clipped second-person taunts and must never enter generated context.'
        }
      ],
      included: [
        {
          id: 'canon_lyra_vow_clocktower',
          text: 'Lyra vowed at the clocktower to return the silver weatherglass before the regent opens the harbor gates.'
        },
        {
          id: 'promise_silver_weatherglass',
          text: 'Readers were promised that the silver weatherglass will reveal which harbor bell lies.'
        }
      ],
      excluded: [{ id: 'sample_banned_duelist_voice', reason: 'restricted_source_sample' }]
    },
    {
      caseId: 'longform_forbidden_style_leak',
      projectId: 'project_longform_fixture',
      query: 'Draft the lighthouse trial confrontation with Lyra and Marrek.',
      policy: {
        id: 'policy_longform_triage_v1',
        description: 'Prioritize accepted canon and promise continuity while excluding restricted prose samples.'
      },
      mustInclude: [
        {
          id: 'canon_lyra_vow_clocktower',
          text: 'Lyra vowed at the clocktower to return the silver weatherglass before the regent opens the harbor gates.'
        },
        {
          id: 'secret_heir_false_name',
          text: 'The false heir travels under the name Corin Vale until the regent sees the hidden birthmark.'
        }
      ],
      forbidden: [
        {
          id: 'sample_banned_duelist_voice',
          text: 'A restricted duelist sample uses clipped second-person taunts and must never enter generated context.'
        }
      ],
      included: [
        {
          id: 'sample_banned_duelist_voice',
          text: 'A restricted duelist sample uses clipped second-person taunts and must never enter generated context.'
        },
        {
          id: 'secret_heir_false_name',
          text: 'The false heir travels under the name Corin Vale until the regent sees the hidden birthmark.'
        }
      ],
      excluded: [{ id: 'canon_lyra_vow_clocktower', reason: 'ranked_below_secret_scene' }]
    }
  ]
};
