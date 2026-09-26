import { type Workout } from './model';

export function previousSession(history: Workout[], current: Workout) {
  return history.filter(w => w.finished && w.id !== current.id && w.templateId === current.templateId && w.date <= current.date)
    .slice().sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function remainingSeconds(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
