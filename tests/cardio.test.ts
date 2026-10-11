import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,newWorkout,stateSchema,sessionSchema,entrySchema,volume,completedSets,completedEntries,cardioMinutes,totalEntries,exerciseKey,type Template} from '../lib/model';
import {cardioProgress,cardioSummary} from '../lib/cardio';
import {programProgress} from '../lib/progress';
import {shareSummary} from '../lib/share';

function program(tracking:'treadmill'|'bike'):Template {
  const template=structuredClone(emptyData().templates[0]);
  template.id=tracking;template.name=tracking;
  template.exercises=[{...template.exercises[0],name:tracking,tracking,targetMinutes:20}];
  return template;
}
function finished(tracking:'treadmill'|'bike') {
  const workout=newWorkout(program(tracking));workout.finished=true;
  workout.exercises[0].cardio={...workout.exercises[0].cardio!,durationMinutes:'20.5',speedKmh:tracking==='treadmill'?'6':'',inclinePercent:'0',done:true};
  return workout;
}
test('existing strength data remains valid; cardio uses time without fake weight or reps',()=>{
  const legacy=emptyData();assert.deepEqual(stateSchema.parse(legacy),legacy);
  const w=finished('treadmill');assert.equal(sessionSchema.safeParse(w).success,true);
  assert.equal(w.exercises[0].sets.length,0);assert.equal(completedSets(w),0);
  assert.equal(completedEntries(w),1);assert.equal(totalEntries(w),1);
  assert.equal(volume(w),0);assert.equal(cardioMinutes(w),20.5);
  const draft=newWorkout(program('bike'));assert.equal(sessionSchema.safeParse(draft).success,true);
  draft.finished=true;assert.equal(sessionSchema.safeParse(draft).success,false);
});
test('treadmill requires positive time and speed, accepts flat incline and rejects invalid numbers',()=>{
  const entry=finished('treadmill').exercises[0];
  for(const [key,value] of [['durationMinutes','0'],['speedKmh',''],['speedKmh','-1'],['inclinePercent',''],['inclinePercent','41'],['durationMinutes','NaN'],['durationMinutes','601']] as const){
    const invalid=structuredClone(entry);invalid.cardio![key]=value;
    assert.equal(entrySchema.safeParse(invalid).success,false,`${key}: ${value}`);
  }
  assert.equal(entrySchema.safeParse(entry).success,true);
});
test('stationary bikes allow consoles without distance, resistance, RPM or watts',()=>{
  const w=finished('bike');const c=w.exercises[0].cardio!;
  assert.equal(sessionSchema.safeParse(w).success,true);
  c.resistance='8';c.distanceKm='7.2';c.cadenceRpm='80';c.watts='120';
  const data=emptyData();data.sessions=[w];data.templates=[program('bike')];
  const loaded=stateSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(loaded.sessions[0].exercises[0].cardio,c);
  assert.ok(cardioSummary(w.exercises[0],'en-US').includes('80 RPM'));
  const fresh=newWorkout(program('bike'),w);
  assert.equal(fresh.exercises[0].cardio?.done,false);
  assert.equal(fresh.exercises[0].cardio?.durationMinutes,'');
});
test('cardio charts are separate from strength and survive deleting a program',()=>{
  const data=emptyData();data.templates=[program('bike')];data.sessions=[finished('bike'),finished('treadmill')];
  assert.equal(programProgress(data,'bike').length,0);
  const charts=cardioProgress(data,'bike');assert.equal(charts.length,1);
  assert.equal(charts[0].points.length,1);assert.equal(charts[0].tracking,'bike');
  data.templates=[];assert.equal(cardioProgress(data,'bike')[0].points[0].cardio.durationMinutes,'20.5');
  const strength={...program('bike').exercises[0],tracking:'strength' as const};
  assert.notEqual(exerciseKey(strength),exerciseKey(program('bike').exercises[0]));
});
test('mixed sessions share cardio duration without inflating completed sets or strength volume',()=>{
  const w=finished('bike');const strength=newWorkout(emptyData().templates[0]).exercises[0];
  strength.sets=[{kg:'20',reps:'10',done:true}];w.exercises.push(strength);
  const share=shareSummary(w);assert.equal(share.exerciseCount,2);assert.equal(share.setCount,1);
  assert.equal(share.volume,200);assert.equal(share.cardioMinutes,20.5);
  assert.equal(completedEntries(w),2);assert.equal(volume(w),200);
  w.exercises[0].cardio!.done=false;
  assert.equal(shareSummary(w).cardioMinutes,0);
});
