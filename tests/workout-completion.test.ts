import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData, newWorkout, exerciseComplete, workoutComplete, finishWorkout, reopenWorkout, stateSchema, emptyCardio, copyPreviousSets, completedEntries, recordedEntries, type Template} from '../lib/model';

function session() {
  const data = emptyData();
  const workout = newWorkout(data.templates[0]);
  for (const entry of workout.exercises) {
    entry.sets = [{kg: '20', reps: '12', done: true}];
  }
  return {data, workout};
}

function skippedSession() {
  const data = emptyData();
  const template: Template = {...data.templates[0], id:'treadmill', name:'Treadmill', exercises:[{
    ...data.templates[0].exercises[0], id:'treadmill', name:'Treadmill', tracking:'treadmill',
  }]};
  data.templates = [template];
  const workout = newWorkout(template);
  workout.exercises[0].cardio = {...emptyCardio(), durationMinutes:'0', speedKmh:'0', inclinePercent:'0', skipped:true, done:false};
  data.draft = workout;
  return {data, workout, template};
}

test('new workouts copy the previous set count, loads and reps while leaving completion unchecked', () => {
  const data = emptyData();
  const previous = newWorkout(data.templates[0]);
  previous.exercises[0].sets = [
    {kg:'20', reps:'12', done:true},
    {kg:'25', reps:'10', done:true},
    {kg:'30', reps:'8', done:true},
  ];
  const next = newWorkout(data.templates[0], previous);
  assert.deepEqual(next.exercises[0].sets, previous.exercises[0].sets.map(set => ({...set, done:false})));
  assert.equal(next.finished, false);
  assert.equal(workoutComplete(next), false);
  next.exercises[0].sets[0].kg = '22.5';
  assert.equal(previous.exercises[0].sets[0].kg, '20');
  const first = newWorkout(data.templates[0]);
  assert.equal(first.exercises[0].sets.length, data.templates[0].exercises[0].minSets);
  assert.equal(first.exercises[0].sets[0].reps, '');
});

test('only the final checked set completes the whole workout', () => {
  const {workout} = session();
  const last = workout.exercises.at(-1)!;
  last.sets[0].done = false;
  assert.equal(exerciseComplete(workout.exercises[0]), true);
  assert.equal(exerciseComplete(last), false);
  assert.equal(workoutComplete(workout), false);
  last.sets[0].done = true;
  assert.equal(workoutComplete(workout), true);
  assert.equal(workoutComplete({...workout, exercises: []}), false);
  assert.equal(exerciseComplete({...last, sets: []}), false);
});

test('an existing draft can receive exact previous set counts and reps without replacing its identity or notes', () => {
  const data = emptyData();
  const previous = newWorkout(data.templates[0]);
  previous.exercises[0].sets = [{kg:'32.5', reps:'9', done:true}];
  previous.exercises[0].sets.push({kg:'20', reps:'', done:false});
  const draft = newWorkout(data.templates[0]);
  draft.notes = 'Today';
  draft.exercises[0].sets = Array.from({length:3}, ()=>({kg:'20', reps:'', done:false}));
  const next = copyPreviousSets(draft, previous);
  assert.deepEqual(next.exercises[0].sets, [{kg:'32.5', reps:'9', done:false}]);
  assert.equal(next.id, draft.id);
  assert.equal(next.date, draft.date);
  assert.equal(next.notes, 'Today');
  assert.equal(draft.exercises[0].sets.length, 3);
  assert.equal(previous.exercises[0].sets[0].done, true);
});

test('mixed sessions must also complete cardio before automatic finish', () => {
  const {workout} = session();
  const bike = {...workout.exercises[0].exercise, id:'bike', tracking:'bike' as const};
  workout.exercises.push({exercise:bike, sets:[], cardio:{...emptyCardio(), durationMinutes:'20'}});
  assert.equal(workoutComplete(workout), false);
  workout.exercises.at(-1)!.cardio!.done = true;
  assert.equal(workoutComplete(workout), true);
});

test('finishing keeps the last entry, clears the draft and never duplicates history', () => {
  const {data, workout} = session();
  data.draft = workout;
  workout.notes = 'Latest session notes';
  const finished = finishWorkout(data, workout);
  assert.equal(finished.draft, null);
  assert.equal(finished.sessions[0].finished, true);
  assert.equal(finished.sessions[0].notes, workout.notes);
  assert.deepEqual(finished.sessions[0].exercises.at(-1), workout.exercises.at(-1));
  assert.equal(stateSchema.safeParse(finished).success, true);
  assert.equal(finishWorkout(finished, workout).sessions.length, 1);
  assert.equal(data.sessions.length, 0);
});

test('manual early finish is allowed, but a session without completed entries is not saved', () => {
  const data = emptyData();
  const workout = newWorkout(data.templates[0]);
  assert.equal(finishWorkout(data, workout), data);
  workout.exercises[0].sets[0] = {kg:'0', reps:'10', done:true};
  assert.equal(workoutComplete(workout), false);
  assert.equal(finishWorkout(data, workout).sessions[0].finished, true);
});

test('a skipped treadmill resolves completion only after its record is confirmed', () => {
  const {workout} = session();
  const skipped = skippedSession().workout.exercises[0];
  workout.exercises.push(skipped);
  assert.equal(exerciseComplete(skipped), false);
  assert.equal(workoutComplete(workout), false);
  const performedCount = completedEntries(workout);
  assert.equal(recordedEntries(workout), performedCount);
  skipped.cardio!.done = true;
  assert.equal(exerciseComplete(skipped), true);
  assert.equal(workoutComplete(workout), true);
  assert.equal(completedEntries(workout), performedCount);
  assert.equal(recordedEntries(workout), performedCount + 1);
  workout.exercises[0].sets[0].done = false;
  assert.equal(workoutComplete(workout), false);
});

test('skip-only sessions require confirmation to save and retain zeros when reopened', () => {
  const {data, workout} = skippedSession();
  workout.notes = 'Treadmill unavailable';
  assert.equal(stateSchema.safeParse(data).success, true);
  assert.equal(completedEntries(workout), 0);
  assert.equal(recordedEntries(workout), 0);
  assert.equal(workoutComplete(workout), false);
  assert.strictEqual(finishWorkout(data, workout), data);
  assert.equal(data.draft, workout);
  assert.equal(data.sessions.length, 0);

  workout.exercises[0].cardio!.done = true;
  assert.equal(workoutComplete(workout), true);
  assert.equal(completedEntries(workout), 0);
  assert.equal(recordedEntries(workout), 1);
  const before = structuredClone(data);
  const finished = finishWorkout(data, workout);
  assert.notStrictEqual(finished, data);
  assert.equal(finished.draft, null);
  assert.equal(finished.sessions.length, 1);
  const saved = finished.sessions[0];
  assert.deepEqual(saved, {...workout, finished:true});
  assert.equal(stateSchema.safeParse(finished).success, true);
  assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(finished))), finished);
  assert.equal(finishWorkout(finished, workout).sessions.length, 1);
  assert.deepEqual(data, before);

  const savedBefore = structuredClone(saved);
  const reopened = reopenWorkout(saved);
  assert.notStrictEqual(reopened, saved);
  assert.notStrictEqual(reopened.exercises[0].cardio, saved.exercises[0].cardio);
  assert.equal(reopened.id, saved.id);
  assert.equal(reopened.date, saved.date);
  assert.equal(reopened.notes, saved.notes);
  assert.equal(reopened.finished, false);
  assert.deepEqual(reopened.exercises[0].cardio, {...saved.exercises[0].cardio!, done:false});
  assert.equal(reopened.exercises[0].cardio!.skipped, true);
  assert.equal(reopened.exercises[0].cardio!.durationMinutes, '0');
  assert.equal(reopened.exercises[0].cardio!.speedKmh, '0');
  assert.equal(reopened.exercises[0].cardio!.inclinePercent, '0');
  assert.equal(exerciseComplete(reopened.exercises[0]), false);
  assert.equal(workoutComplete(reopened), false);
  assert.equal(completedEntries(reopened), 0);
  assert.equal(recordedEntries(reopened), 0);
  const editing = {...finished, draft:reopened};
  assert.equal(stateSchema.safeParse(editing).success, true);
  assert.strictEqual(finishWorkout(editing, reopened), editing);
  assert.deepEqual(saved, savedBefore);

  reopened.exercises[0].cardio!.done = true;
  const resaved = finishWorkout(editing, reopened);
  assert.equal(resaved.sessions.length, 1);
  assert.equal(resaved.sessions[0].id, saved.id);
  assert.equal(resaved.sessions[0].exercises[0].cardio!.skipped, true);
  assert.equal(resaved.draft, null);
  assert.equal(workoutComplete(resaved.sessions[0]), true);
  assert.equal(stateSchema.safeParse(resaved).success, true);
  assert.deepEqual(saved, savedBefore);
});

test('new workouts reset skipped participation and zero metrics without changing history', () => {
  const {workout, template} = skippedSession();
  workout.exercises[0].cardio!.done = true;
  workout.finished = true;
  const before = structuredClone(workout);
  const fresh = newWorkout(template, workout);
  assert.notEqual(fresh.id, workout.id);
  assert.equal(fresh.finished, false);
  assert.deepEqual(fresh.exercises[0].cardio, emptyCardio());
  assert.equal(Object.hasOwn(fresh.exercises[0].cardio!, 'skipped'), false);
  assert.equal(workoutComplete(fresh), false);
  assert.equal(completedEntries(fresh), 0);
  assert.equal(recordedEntries(fresh), 0);
  assert.deepEqual(workout, before);
});

test('history corrections unlock entries without changing values or the stored session', () => {
  const {workout} = session();
  workout.finished = true;
  workout.exercises.push({exercise:{...workout.exercises[0].exercise, id:'bike', tracking:'bike'}, sets:[], cardio:{...emptyCardio(), durationMinutes:'25', done:true}});
  const draft = reopenWorkout(workout);
  assert.equal(draft.id, workout.id);
  assert.equal(draft.finished, false);
  assert.equal(draft.exercises[0].sets[0].done, false);
  assert.equal(draft.exercises[0].sets[0].kg, '20');
  assert.equal(draft.exercises.at(-1)!.cardio!.done, false);
  assert.equal(draft.exercises.at(-1)!.cardio!.durationMinutes, '25');
  assert.equal(workoutComplete(draft), false);
  assert.equal(workoutComplete(workout), true);
});
