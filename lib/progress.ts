import { exerciseKey, type Data } from './model';

export function progressPrograms(data: Data) {
  const programs = new Map(data.templates.map(t => [t.id, { id: t.id, name: t.name }]));
  for (const session of data.sessions) {
    if (!programs.has(session.templateId)) programs.set(session.templateId, { id: session.templateId, name: session.name });
  }
  return [...programs.values()];
}

export function programProgress(data: Data, templateId: string) {
  const sessions = data.sessions.filter(s => s.finished && s.templateId === templateId)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const names = new Map<string, string>();
  for (const exercise of data.templates.find(t => t.id === templateId)?.exercises ?? []) names.set(exerciseKey(exercise), exercise.name);
  for (const session of sessions) for (const entry of session.exercises) {
    if (entry.sets.some(s => s.done)) names.set(exerciseKey(entry.exercise), entry.exercise.name);
  }
  return [...names].map(([key, name]) => {
    const points = sessions.flatMap(session => {
      const sets = session.exercises.filter(e => exerciseKey(e.exercise) === key).flatMap(e => e.sets.filter(s => s.done));
      return sets.length ? [{ date: session.date, kg: Math.max(...sets.map(s => Number(s.kg))) }] : [];
    });
    return { key, name, best: points.length ? Math.max(...points.map(p => p.kg)) : null, points: points.slice(-12) };
  });
}
