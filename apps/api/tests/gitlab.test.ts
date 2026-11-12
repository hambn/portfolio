import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { identities } from '../src/identities.js';
import { calendarDays } from '@portfolio/shared/gitlab';
import { testServices } from './helpers.js';

const NOW = Date.parse('2026-06-15T12:00:00Z');

test('calendarDays fills a whole year ending today, oldest first', () => {
  const days = calendarDays({ '2026-06-15': 12, '2026-06-14': 3, '2020-01-01': 99 }, NOW);
  assert.equal(days.length, 365);
  assert.equal(days[0].date, '2025-06-16');
  assert.deepEqual(days.at(-1), { date: '2026-06-15', count: 12, level: 2 });
  assert.deepEqual(days.at(-2), { date: '2026-06-14', count: 3, level: 1 });
  assert.deepEqual(days.at(-3), { date: '2026-06-13', count: 0, level: 0 });
});

test('/gitlab/contributions serves the real calendar and outlives an outage', async () => {
  let down = false;
  const calls: string[] = [];
  let clock = NOW;
  const tasks: Promise<unknown>[] = [];
  const services = testServices({
    now: () => clock,
    background: (task) => void tasks.push(task.catch(() => {})),
    fetch: async (input) => {
      calls.push(String(input));
      if (down) return new Response('down', { status: 503 });
      return Response.json({ '2026-06-15': 4, '2026-06-01': 31 });
    },
  });
  const read = async () => {
    const response = await handleRequest(
      new Request('https://api.test/gitlab/contributions'),
      services,
    );
    return {
      status: response.status,
      body: (await response.json()) as {
        total: { lastYear: number };
        contributions: { date: string; count: number; level: number }[];
      },
    };
  };
  const first = await read();
  assert.equal(first.status, 200);
  assert.equal(calls[0], `https://gitlab.com/users/${identities.gitlab}/calendar.json`);
  assert.equal(first.body.total.lastYear, 35);
  assert.equal(first.body.contributions.length, 365);
  assert.deepEqual(first.body.contributions.at(-1), { date: '2026-06-15', count: 4, level: 1 });

  // A day later GitLab is down: the stored calendar is served, re-dated to today.
  clock += 86400 * 1000;
  down = true;
  const later = await read();
  await Promise.all(tasks);
  assert.equal(later.status, 200);
  assert.equal(later.body.contributions.at(-1)?.date, '2026-06-16');
  assert.equal(later.body.contributions.at(-2)?.count, 4);
});

test('/gitlab/contributions is pinned to the configured account', async () => {
  const response = await handleRequest(
    new Request('https://api.test/gitlab/contributions?username=someone-else'),
    testServices(),
  );
  assert.equal(response.status, 400);
});
