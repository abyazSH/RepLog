import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData, newWorkout, exerciseComplete, workoutComplete, finishWorkout, reopenWorkout, stateSchema, emptyCardio, copyPreviousSets} from '../lib/model';

function session() {
  const data = emptyData();
  const workout = newWorkout(data.templates[0]);
  for (const entry of workout.exercises) {
    entry.sets = [{kg: '20', reps: '12', done: true}];
  }
  return {data, workout};
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
