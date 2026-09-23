import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, newWorkout } from '../lib/model';
import { programProgress, progressPrograms } from '../lib/progress';

test('program charts separate identical exercises across programs and preserve historical variants', () => {
  const data = emptyData();
  const pull = data.templates[0];
  const push = data.templates[1];
  const session = newWorkout(pull);
  session.finished = true;
  session.exercises[0].sets = [{ kg: '30', reps: '10', done: true }, { kg: '90', reps: '', done: false }];
  const other = newWorkout(push);
  other.finished = true;
  other.exercises = [{ exercise: pull.exercises[0], sets: [{ kg: '100', reps: '10', done: true }] }];
  data.sessions = [session, other];
  const charts = programProgress(data, pull.id);
  assert.equal(charts[0].best, 30);
  assert.equal(charts[0].points.length, 1);
  assert.equal(charts[1].points.length, 0);
  session.exercises[0].exercise = { ...session.exercises[0].exercise, name: 'Historical machine variant' };
  assert.ok(programProgress(data, pull.id).some(c => c.name === 'Historical machine variant' && c.best === 30));
  data.templates = data.templates.filter(t => t.id !== pull.id);
  assert.ok(progressPrograms(data).some(p => p.id === pull.id));
});
