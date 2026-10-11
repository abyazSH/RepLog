import {isCardio,entrySchema,type Workout} from './model';
export function shareSummary(workout: Workout) {
 const exercises=workout.exercises.flatMap(entry=>{
   if(isCardio(entry.exercise)) {
     return entry.cardio?.done && entrySchema.safeParse(entry).success ? [{name:entry.exercise.name,setCount:0,cardioMinutes:Number(entry.cardio.durationMinutes),volume:0}] : [];
   }
   const sets=entry.sets.filter(s=>s.done&&s.kg!==''&&s.reps!==''&&Number.isFinite(Number(s.kg))&&Number(s.kg)>=0&&Number.isFinite(Number(s.reps))&&Number(s.reps)>0);
   return sets.length ? [{name:entry.exercise.name,setCount:sets.length,cardioMinutes:0,volume:sets.reduce((sum,s)=>sum+Number(s.kg)*Number(s.reps),0)}] : [];
 });
 return {name:workout.name,date:workout.date,exerciseCount:exercises.length,setCount:exercises.reduce((sum,e)=>sum+e.setCount,0),cardioMinutes:exercises.reduce((sum,e)=>sum+e.cardioMinutes,0),volume:exercises.reduce((sum,e)=>sum+e.volume,0),exercises:exercises.map(({name,setCount,cardioMinutes})=>({name,setCount,cardioMinutes}))};
}
