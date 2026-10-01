import type { Workout } from './model';
export function shareSummary(workout: Workout) {
  const exercises = workout.exercises.map(({exercise,sets})=>({name:exercise.name,sets:sets.filter(s=>s.done&&s.kg!==''&&s.reps!==''&&Number.isFinite(Number(s.kg))&&Number(s.kg)>=0&&Number.isFinite(Number(s.reps))&&Number(s.reps)>0)})).filter(e=>e.sets.length);
  return {name:workout.name,date:workout.date,exerciseCount:exercises.length,setCount:exercises.reduce((sum,e)=>sum+e.sets.length,0),volume:exercises.reduce((sum,e)=>sum+e.sets.reduce((n,s)=>n+Number(s.kg)*Number(s.reps),0),0),exercises:exercises.map(e=>({name:e.name,setCount:e.sets.length}))};
}
