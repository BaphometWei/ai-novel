import { createId } from '@ai-novel/domain';
import type { TaskContract } from './task-contract';

export type RunStepStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed';

export interface RunStepInput {
  name: string;
  artifactIds: string[];
  status: RunStepStatus;
  error?: string;
  retryAttempt?: number;
}

export interface RunStep extends RunStepInput {
  order: number;
  retryAttempt: number;
}

export interface WorkflowRun {
  id: string;
  taskContractId: string;
  steps: RunStep[];
}

export class WorkflowRunner {
  async run(contract: TaskContract, steps: RunStepInput[]): Promise<WorkflowRun> {
    return {
      id: `workflow_run_${createId('agent_run').slice('agent_run_'.length)}`,
      taskContractId: contract.id,
      steps: steps.map((step, index) => ({
        ...step,
        order: index + 1,
        retryAttempt: step.retryAttempt ?? 0
      }))
    };
  }

  resume(run: WorkflowRun, step: RunStepInput): WorkflowRun {
    return {
      ...run,
      steps: [
        ...run.steps,
        {
          ...step,
          order: run.steps.length + 1,
          retryAttempt: step.retryAttempt ?? 0
        }
      ]
    };
  }
}
