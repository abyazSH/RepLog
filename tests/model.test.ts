import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyData,
  templates,
  newWorkout,
  stateSchema,
  volume,
  completedSets,
  bestSets,
} from "../lib/model";
test("incomplete, negative, or zero-rep completed sets cannot reach storage", () => {
  const data = emptyData();
  data.draft = newWorkout(templates[0]);
  const set = data.draft.exercises[0].sets[0];
  set.done = true;
  assert.equal(stateSchema.safeParse(data).success, false);
  set.kg = "-5";
  set.reps = "12";
  assert.equal(stateSchema.safeParse(data).success, false);
  set.kg = "0";
  set.reps = "0";
  assert.equal(stateSchema.safeParse(data).success, false);
  set.reps = "12";
  assert.equal(stateSchema.safeParse(data).success, true);
});
test("metrics count only completed sets and keep exercise variants apart", () => {
  const data = emptyData();
  const w = newWorkout(templates[1]);
  w.finished = true;
  w.exercises[0].sets = [
    { kg: "30", reps: "12", done: true },
    { kg: "500", reps: "20", done: false },
  ];
  data.sessions = [w];
  assert.equal(volume(w), 360);
  assert.equal(completedSets(w), 1);
  assert.equal(bestSets(data, "chest press").length, 1);
  assert.equal(bestSets(data, "bench press").length, 0);
});
test("new session copies loads without copying completion and snapshots survive template edits", () => {
  const template = structuredClone(templates[0]);
  const first = newWorkout(template);
  first.exercises[0].sets[0] = { kg: "35", reps: "12", done: true };
  const second = newWorkout(template, first);
  assert.equal(second.exercises[0].sets[0].kg, "35");
  assert.equal(second.exercises[0].sets[0].reps, "");
  assert.equal(second.exercises[0].sets[0].done, false);
  template.exercises[0].name = "Changed machine";
  assert.equal(first.exercises[0].exercise.name, "Lat Pulldown");
});
test("invalid target ranges, empty completed sessions, and duplicate session IDs are rejected", () => {
  const data = emptyData();
  data.templates[0].exercises[0].minReps = 20;
  assert.equal(stateSchema.safeParse(data).success, false);
  const valid = emptyData();
  const w = newWorkout(templates[0]);
  w.finished = true;
  valid.sessions = [w];
  assert.equal(stateSchema.safeParse(valid).success, false);
  w.exercises[0].sets[0] = { kg: "10", reps: "12", done: true };
  assert.equal(stateSchema.safeParse(valid).success, true);
  valid.sessions.push(structuredClone(w));
  assert.equal(stateSchema.safeParse(valid).success, false);
});
