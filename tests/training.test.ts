import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, newWorkout } from '../lib/model';
import { previousSession, remainingSeconds } from '../lib/training';

test('previous session uses the same program, excludes current and future sessions', () => {
  const data = emptyData();
  const current = newWorkout(data.templates[1]);
  current.date = '2026-09-26T10:00:00.000Z';
  const earlier = { ...structuredClone(current), id: 'earlier', finished: true, date: '2026-09-22T10:00:00.000Z' };
  const latest = { ...structuredClone(earlier), id: 'latest', date: '2026-09-24T10:00:00.000Z' };
  const other = { ...structuredClone(latest), id: 'other', templateId: data.templates[0].id, date: '2026-09-25T10:00:00.000Z' };
  const future = { ...structuredClone(latest), id: 'future', date: '2026-09-28T10:00:00.000Z' };
  assert.equal(previousSession([earlier, other, future, current, latest], current)?.id, 'latest');
  assert.equal(previousSession([other, future, current], current), undefined);
});

test('rest countdown derives from real time, tolerates throttled tabs, and never goes negative', () => {
  assert.equal(remainingSeconds(91000, 1000), 90);
  assert.equal(remainingSeconds(91000, 1150), 90);
  assert.equal(remainingSeconds(91000, 61000), 30);
  assert.equal(remainingSeconds(91000, 95000), 0);
});
