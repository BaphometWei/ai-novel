import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('approvals persistent runtime', () => {
  it('lists seeded pending approvals from the DB in persistent runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const { app, database } = runtime;

    await seedProject(database.client);
    // seed an approval row directly
    await database.client.execute(`INSERT INTO approval_requests (id, project_id, target_type, target_id, risk_level, reason, proposed_action, status, created_at) VALUES (
      'approval_persist_1', 'project_seed', 'canon_fact', 'fact_seed', 'High', 'Seed reason', 'promote', 'Pending', '2026-04-27T00:00:00.000Z'
    )`);

    const response = await app.inject({ method: 'GET', url: '/approvals' });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.items).toBeInstanceOf(Array);
    expect(json.items.some((it: any) => it.id === 'approval_persist_1')).toBe(true);

    database.client.close();
    await app.close();
  });

  it('approve and reject update DB row status via persistent runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const { app, database } = runtime;

    await seedProject(database.client);
    await database.client.execute(`INSERT INTO approval_requests (id, project_id, target_type, target_id, risk_level, reason, proposed_action, status, created_at) VALUES (
      'approval_persist_2', 'project_seed', 'canon_fact', 'fact_seed_2', 'Medium', 'Approve me', 'promote', 'Pending', '2026-04-27T00:01:00.000Z'
    )`);

    const approveResp = await app.inject({ method: 'POST', url: '/approvals/approval_persist_2/approve', payload: { decidedBy: 'operator', note: 'OK' } });
    expect(approveResp.statusCode).toBe(200);
    expect(approveResp.json().status).toBe('Approved');

    // read directly from DB to ensure persistence
    const rows = await database.client.execute("SELECT status FROM approval_requests WHERE id = 'approval_persist_2'");
    expect(rows.rows[0].status).toBe('Approved');

    // insert another and reject
    await database.client.execute(`INSERT INTO approval_requests (id, project_id, target_type, target_id, risk_level, reason, proposed_action, status, created_at) VALUES (
      'approval_persist_3', 'project_seed', 'canon_fact', 'fact_seed_3', 'Medium', 'Reject me', 'promote', 'Pending', '2026-04-27T00:02:00.000Z'
    )`);

    const rejectResp = await app.inject({ method: 'POST', url: '/approvals/approval_persist_3/reject', payload: { decidedBy: 'operator', note: 'No' } });
    expect(rejectResp.statusCode).toBe(200);
    expect(rejectResp.json().status).toBe('Rejected');

    const rows2 = await database.client.execute("SELECT status FROM approval_requests WHERE id = 'approval_persist_3'");
    expect(rows2.rows[0].status).toBe('Rejected');

    database.client.close();
    await app.close();
  });
});

async function seedProject(client: { execute(sql: string): Promise<unknown> }) {
  await client.execute(`INSERT INTO projects (id, title, language, status, reader_contract_json, created_at, updated_at) VALUES (
    'project_seed', 'Seed Project', 'zh-CN', 'Active', '{}', '2026-04-27T00:00:00.000Z', '2026-04-27T00:00:00.000Z'
  )`);
}
