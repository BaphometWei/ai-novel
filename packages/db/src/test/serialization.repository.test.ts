import { createProject, createSerializationPlan, type ReaderFeedback } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ProjectRepository } from '../repositories/project.repository';
import { SerializationRepository } from '../repositories/serialization.repository';

describe('SerializationRepository', () => {
  it('persists serialization plans and reader feedback', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projectRepository = new ProjectRepository(database.db);
    const serializationRepository = new SerializationRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await projectRepository.save(project);
    const plan = createSerializationPlan({
      projectId: project.id,
      platformProfile: {
        id: 'platform_qidian',
        name: 'Qidian',
        targetCadence: 'daily',
        chapterLengthRange: { min: 2200, max: 3200 }
      },
      updateSchedule: {
        timezone: 'Asia/Shanghai',
        slots: [{ weekday: 1, localTime: '20:00' }],
        bufferTargetChapters: 7,
        currentBufferChapters: 3
      }
    });
    const feedback: ReaderFeedback = {
      id: 'feedback_1',
      chapterId: 'chapter_1',
      segment: 'core_reader',
      sentiment: 'Negative',
      tags: ['pacing'],
      text: 'Bridge chapter slows down.'
    };

    await serializationRepository.savePlan(plan);
    await serializationRepository.saveReaderFeedback(project.id, feedback);

    const savedPlan = await serializationRepository.findPlanById(plan.id);
    const savedFeedback = await serializationRepository.listReaderFeedback(project.id);

    expect(savedPlan?.updateSchedule.bufferGap).toBe(4);
    expect(savedFeedback).toEqual([feedback]);
    database.client.close();
  });
});
