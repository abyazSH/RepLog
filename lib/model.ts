import { z } from "zod";
const id = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(100);
export const exerciseSchema = z
  .object({
    id,
    name,
    kind: z.enum(["C", "I"]),
    tracking: z.enum(["strength", "treadmill", "bike"]).optional(),
    targetMinutes: z.number().positive().max(600).optional(),
    targetSpeedKmh: z.number().positive().max(50).optional(),
    targetInclinePercent: z.number().min(0).max(40).optional(),
    minSets: z.number().int().min(1).max(10),
    maxSets: z.number().int().min(1).max(10),
    minReps: z.number().int().min(1).max(100),
    maxReps: z.number().int().min(1).max(100),
    alternatives: z.array(name).max(8),
  })
  .refine(
    (x) => x.minSets <= x.maxSets && x.minReps <= x.maxReps,
    "Rentang target tidak valid",
  );
export const templateSchema = z.object({
  id,
  name,
  day: z.number().int().min(0).max(6),
  focus: name,
  exercises: z.array(exerciseSchema).min(1).max(30),
});
const setSchema = z
  .object({
    kg: z
      .string()
      .max(12)
      .refine(
        (v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) <= 1500),
        "Beban tidak valid",
      ),
    reps: z
      .string()
      .max(4)
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 1000),
        "Repetisi tidak valid",
      ),
    done: z.boolean(),
  })
  .refine(
    (v) => !v.done || (v.kg !== "" && Number(v.reps) > 0),
    "Isi beban dan repetisi sebelum menyelesaikan set",
  );
const cardioNumber = (max: number) => z.string().max(12).refine(v => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) <= max), "Angka kardio tidak valid");
export const cardioSchema = z.object({
  durationMinutes: cardioNumber(600), speedKmh: cardioNumber(50), inclinePercent: cardioNumber(40),
  resistance: cardioNumber(1000), distanceKm: cardioNumber(500), cadenceRpm: cardioNumber(300), watts: cardioNumber(3000), done: z.boolean(),
});
export type Cardio = z.infer<typeof cardioSchema>;
export const isCardio = (e: Exercise) => e.tracking === "treadmill" || e.tracking === "bike";
export function emptyCardio(): Cardio { return {durationMinutes:"",speedKmh:"",inclinePercent:"0",resistance:"",distanceKm:"",cadenceRpm:"",watts:"",done:false}; }
export const entrySchema = z.object({exercise:exerciseSchema,sets:z.array(setSchema).max(10),cardio:cardioSchema.optional()}).refine(entry => {
  if(!isCardio(entry.exercise)) return entry.sets.length > 0 && !entry.cardio;
  if(entry.sets.length || !entry.cardio) return false;
  const c=entry.cardio;
  return !c.done || (Number(c.durationMinutes)>0 && (entry.exercise.tracking !== "treadmill" || (Number(c.speedKmh)>0 && c.inclinePercent!=="")));
}, "Isi durasi; treadmill juga memerlukan speed dan incline. Latihan beban memerlukan set.");
export const sessionSchema = z
  .object({
    id,
    templateId: id,
    name,
    date: z.string().datetime(),
    finished: z.boolean(),
    notes: z.string().max(2000),
    exercises: z
      .array(
        entrySchema,
      )
      .min(1)
      .max(30),
  })
  .refine(
    (s) => !s.finished || s.exercises.some((e) => e.cardio?.done || e.sets.some((s) => s.done)),
    "Selesaikan minimal satu set atau kardio",
  );
export const stateSchema = z
  .object({
    templates: z.array(templateSchema).max(20),
    sessions: z.array(sessionSchema).max(2000),
    draft: sessionSchema.nullable(),
    weights: z
      .array(
        z.object({
          id,
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          kg: z.number().positive().max(500),
        }),
      )
      .max(3000),
  })
  .refine(
    (s) =>
      s.sessions.every((x) => x.finished) && (!s.draft || !s.draft.finished),
    "Status sesi tidak valid",
  )
  .refine(
    (s) => new Set(s.sessions.map((x) => x.id)).size === s.sessions.length,
    "ID sesi duplikat",
  );
export type Exercise = z.infer<typeof exerciseSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Workout = z.infer<typeof sessionSchema>;
export type Data = z.infer<typeof stateSchema>;
export function exercise(
  id: string,
  name: string,
  kind: "C" | "I",
  reps = [10, 12],
  sets = [2, 3],
  alternatives: string[] = [],
): Exercise {
  return {
    id,
    name,
    kind,
    minReps: reps[0],
    maxReps: reps[1],
    minSets: sets[0],
    maxSets: sets[1],
    alternatives,
  };
}
export const templates: Template[] = [
  {
    id: "pull",
    name: "Pull",
    day: 1,
    focus: "Punggung & biceps",
    exercises: [
      exercise("lat-pulldown", "Lat Pulldown", "C"),
      exercise("cable-row", "Seated Cable Row", "C"),
      exercise("straight-pulldown", "Straight-Arm Pulldown", "I", [12, 15]),
      exercise("face-pull", "Face Pull", "I", [12, 15]),
      exercise(
        "db-curl",
        "Dumbbell Curl",
        "I",
        [10, 12],
        [2, 3],
        ["Barbell Curl", "Preacher Curl Machine"],
      ),
    ],
  },
  {
    id: "push",
    name: "Push",
    day: 2,
    focus: "Dada, bahu & triceps",
    exercises: [
      exercise(
        "chest-press",
        "Chest Press",
        "C",
        [10, 12],
        [2, 3],
        ["Bench Press"],
      ),
      exercise("incline-machine", "Incline Machine Press", "C"),
      exercise("overhead-press", "Overhead Press", "C", [8, 10]),
      exercise("db-lateral", "Dumbbell Lateral Raise", "I", [12, 15], [3, 3]),
      exercise("triceps-pushdown", "Triceps Pushdown", "I"),
    ],
  },
  {
    id: "legs",
    name: "Legs",
    day: 3,
    focus: "Kaki",
    exercises: [
      exercise("leg-press", "Leg Press", "C"),
      exercise("rdl", "Romanian Deadlift", "C", [8, 10]),
      exercise("leg-curl", "Leg Curl", "I"),
      exercise("leg-extension", "Leg Extension", "I", [12, 15]),
      exercise("calf-raise", "Calf Raise", "I", [12, 15]),
    ],
  },
  {
    id: "shoulders",
    name: "Shoulder + Arms",
    day: 4,
    focus: "Bahu & lengan",
    exercises: [
      exercise("shoulder-machine", "Shoulder Press Machine", "C", [8, 10]),
      exercise("row-machine", "Seated Row Machine", "C"),
      exercise(
        "lateral-machine",
        "Lateral Raise Machine",
        "I",
        [12, 15],
        [3, 3],
      ),
      exercise("reverse-fly", "Rear Delt / Pec Deck Machine", "I", [12, 15]),
      exercise(
        "preacher",
        "Preacher Curl Machine",
        "I",
        [10, 12],
        [2, 3],
        ["Cable Curl"],
      ),
      exercise("triceps-pushdown", "Triceps Pushdown", "I"),
    ],
  },
  {
    id: "chest-core",
    name: "Chest + Core",
    day: 6,
    focus: "Dada & core",
    exercises: [
      exercise("flat-machine", "Flat Machine Press", "C", [8, 10]),
      exercise("high-low", "High to Low Cable Fly", "I", [12, 15]),
      exercise("low-high", "Low to High Cable Fly", "I", [12, 15]),
      exercise("ab-crunch", "Ab Crunch Machine", "I", [12, 15]),
    ],
  },
];
export function emptyData(): Data {
  return {
    templates: structuredClone(templates),
    sessions: [],
    draft: null,
    weights: [],
  };
}
export function volume(w: Workout) {
  return w.exercises.reduce(
    (a, e) =>
      a +
      (isCardio(e.exercise) ? [] : e.sets)
        .filter((s) => s.done)
        .reduce((a, s) => a + Number(s.kg) * Number(s.reps), 0),
    0,
  );
}
export function completedSets(w: Workout) {
  return w.exercises.filter(e=>!isCardio(e.exercise)).flatMap((e) => e.sets).filter((s) => s.done).length;
}
export function exerciseKey(e: Exercise) {
  return (isCardio(e) ? e.tracking + ":" : "") + e.name.trim().toLowerCase();
}
export function bestSets(data: Data, key: string) {
  return data.sessions.flatMap((w) =>
    w.exercises
      .filter((e) => !isCardio(e.exercise) && exerciseKey(e.exercise) === key)
      .flatMap((e) =>
        e.sets.filter((s) => s.done).map((s) => ({ ...s, date: w.date })),
      ),
  );
}
export function newWorkout(t: Template, previous?: Workout): Workout {
  const workout: Workout = {
    id: crypto.randomUUID(),
    templateId: t.id,
    name: t.name,
    date: new Date().toISOString(),
    finished: false,
    notes: "",
    exercises: t.exercises.map((e) => {
      if (isCardio(e)) return {exercise:structuredClone(e),sets:[],cardio:emptyCardio()};
      return {
        exercise: structuredClone(e),
        sets: Array.from({ length: e.minSets }, () => ({
          kg: "",
          reps: "",
          done: false,
        })),
      };
    }),
  };
  return previous ? copyPreviousSets(workout, previous) : workout;
}

export function copyPreviousSets(workout: Workout, previous: Workout): Workout {
  const next = structuredClone(workout);
  for (const entry of next.exercises) {
    if (isCardio(entry.exercise)) continue;
    const prior = previous.exercises.find(p => !isCardio(p.exercise) && exerciseKey(p.exercise) === exerciseKey(entry.exercise));
    const completed = prior?.sets.filter(set => set.done) ?? [];
    if (completed.length) entry.sets = completed.map(set => ({kg:set.kg, reps:set.reps, done:false}));
  }
  return next;
}

export function cardioMinutes(w: Workout) { return w.exercises.reduce((sum,e)=>sum+(isCardio(e.exercise)&&e.cardio?.done?Number(e.cardio.durationMinutes):0),0); }
export function completedEntries(w: Workout) { return completedSets(w)+w.exercises.filter(e=>isCardio(e.exercise)&&e.cardio?.done).length; }
export function totalEntries(w: Workout) { return w.exercises.reduce((sum,e)=>sum+(isCardio(e.exercise)?1:e.sets.length),0); }

export function exerciseComplete(entry: Workout['exercises'][number]) {
  return isCardio(entry.exercise)
    ? entry.cardio?.done === true
    : entry.sets.length > 0 && entry.sets.every(set => set.done);
}
export function workoutComplete(workout: Workout) {
  return workout.exercises.length > 0 && workout.exercises.every(exerciseComplete);
}
export function finishWorkout(data: Data, workout: Workout): Data {
  if (!completedEntries(workout)) return data;
  return {...data, draft: null, sessions: [
    {...workout, finished: true},
    ...data.sessions.filter(session => session.id !== workout.id),
  ]};
}
export function reopenWorkout(workout: Workout): Workout {
  const draft = structuredClone(workout);
  draft.finished = false;
  for (const entry of draft.exercises) {
    for (const set of entry.sets) set.done = false;
    if (entry.cardio) entry.cardio.done = false;
  }
  return draft;
}
