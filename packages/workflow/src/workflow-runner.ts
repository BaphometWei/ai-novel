import type { TaskContract } from './task-contract';

export type RunStepStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed';

export interface RunStepInput {
  name: string;
  artifactIds: string[];
  status: RunStepStatus;
  error?: string;
}

export interface RunStep extends RunStepInput {
  order: number;
  retryAttempt: number;
}

export interface WorkflowRun {
  taskContractId: string;
  steps: RunStep[];
}

export class WorkflowRunner {
  async run(contract: TaskContract, steps: RunStepInput[]): Promise<WorkflowRun> {
    return {
      taskContractId: contract.id,
      steps: steps.map((step, index) => ({
        ...step,
        order: index + 1,
        retryAttempt: 0
      }))
    };
  }
}
