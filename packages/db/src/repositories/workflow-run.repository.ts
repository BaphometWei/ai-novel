import type { WorkflowRun } from '@ai-novel/workflow';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { workflowRuns } from '../schema';

export class WorkflowRunRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(run: WorkflowRun): Promise<void> {
    await this.db
      .insert(workflowRuns)
      .values({
        id: run.id,
        taskContractId: run.taskContractId,
        stepsJson: JSON.stringify(run.steps)
      })
      .onConflictDoUpdate({
        target: workflowRuns.id,
        set: {
          taskContractId: run.taskContractId,
          stepsJson: JSON.stringify(run.steps)
        }
      });
  }

  async findById(id: string): Promise<WorkflowRun | null> {
    const row = await this.db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).get();
    if (!row) return null;

    return {
      id: row.id,
      taskContractId: row.taskContractId,
      steps: JSON.parse(row.stepsJson) as WorkflowRun['steps']
    };
  }
}
