import {
  AgentRunRepository,
  ContextPackRepository,
  createDatabase,
  DurableJobRepository,
  LlmCallLogRepository,
  migrateDatabase,
  ProjectRepository,
  WorkflowRunRepository
} from '@ai-novel/db';
import { createProject } from '@ai-novel/domain';
import { createFakeProvider, LlmGateway } from '@ai-novel/llm-gateway';
import type { DurableJob } from '@ai-novel/workflow';
import { describe, expect, it } from 'vitest';
import {
  AgentOrchestrationError,
  createAgentOrchestrationService
} from '../services/agent-orchestration.service';
import { PersistentProjectService } from '../services/project.service';

describe('agent orchestration service failure persistence', () => {
  it('persists a failed orchestration run when structured output cannot be repaired', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projectService = new PersistentProjectService(new ProjectRepository(database.db));
    const project = await projectService.create({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const service = createAgentOrchestrationService(
      {
        projects: projectService,
        contextPacks: new ContextPackRepository(database.db),
        agentRuns: new AgentRunRepository(database.db),
        llmCallLogs: new LlmCallLogRepository(database.db),
        workflowRuns: new WorkflowRunRepository(database.db),
        durableJobs: new DurableJobRepository(database.db)
      },
      ({ promptVersionId }) =>
        new LlmGateway({
          provider: createFakeProvider({
            text: 'invalid',
            structured: 'not an object',
            embedding: [],
            usage: { inputTokens: 10, outputTokens: 3 }
          }),
          defaultModel: 'fake-model',
          promptVersionId
        })
    );

    let orchestrationRunId: string | undefined;
    try {
      await service.start({
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the next siege chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The city is under siege.' }]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AgentOrchestrationError);
      orchestrationRunId = (error as AgentOrchestrationError).orchestrationRunId;
    }

    expect(orchestrationRunId).toMatch(/^job_/);
    const failed = await service.findById(orchestrationRunId ?? '');

    expect(failed).toMatchObject({
      job: { status: 'Failed' },
      agentRun: { status: 'Failed' },
      workflowRun: {
        steps: [
          { name: 'create_context_pack', status: 'Succeeded' },
          { name: 'create_agent_run', status: 'Succeeded' },
          { name: 'generate_structured_output', status: 'Failed' },
          { name: 'persist_llm_call_log', status: 'Succeeded' }
        ]
      },
      llmCalls: [{ status: 'Failed', retryCount: 2, error: 'Structured output failed validation for ChapterPlan' }]
    });

    database.client.close();
  });

  it('marks the durable job failed when persistence fails after the job starts', async () => {
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const jobs = new Map<string, DurableJob>();
    const service = createAgentOrchestrationService(
      {
        projects: {
          async findById() {
            return project;
          }
        },
        contextPacks: {
          async save() {
            throw new Error('context database unavailable');
          },
          async findById() {
            return null;
          }
        },
        agentRuns: {
          async save() {},
          async findById() {
            return null;
          }
        },
        llmCallLogs: {
          async save() {},
          async findByAgentRunId() {
            return [];
          }
        },
        workflowRuns: {
          async save() {},
          async findById() {
            return null;
          }
        },
        durableJobs: {
          async save(job) {
            jobs.set(job.id, job);
          },
          async findById(id) {
            return jobs.get(id) ?? null;
          }
        }
      },
      ({ promptVersionId }) =>
        new LlmGateway({
          provider: createFakeProvider({
            text: 'unused',
            structured: { ok: true },
            embedding: []
          }),
          defaultModel: 'fake-model',
          promptVersionId
        })
    );

    let orchestrationRunId: string | undefined;
    try {
      await service.start({
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the next siege chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The city is under siege.' }]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AgentOrchestrationError);
      orchestrationRunId = (error as AgentOrchestrationError).orchestrationRunId;
    }

    expect(orchestrationRunId).toMatch(/^job_/);
    const failed = await service.findById(orchestrationRunId ?? '');

    expect(failed).toMatchObject({
      orchestrationRunId,
      job: {
        status: 'Failed',
        payload: { error: 'context database unavailable' }
      },
      contextPack: null,
      agentRun: null,
      workflowRun: null,
      llmCalls: []
    });
  });
});
