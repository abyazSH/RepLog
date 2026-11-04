import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,emptyCardio,newWorkout,stateSchema,sessionSchema,entrySchema,volume,completedSets,completedEntries,recordedEntries,cardioMinutes,totalEntries,exerciseKey,type Template} from '../lib/model';
import {cardioProgress,cardioSummary,setTreadmillParticipation} from '../lib/cardio';
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
function skipped(done=true) {
  const workout=newWorkout(program('treadmill'));workout.finished=done;
  workout.exercises[0].cardio={...emptyCardio(),durationMinutes:'0',speedKmh:'0',inclinePercent:'0',skipped:true,done};
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
test('legacy positive cardio records remain valid without introducing a skipped flag',()=>{
  for(const tracking of ['treadmill','bike'] as const){
    const workout=finished(tracking);const entry=workout.exercises[0];
    assert.equal(Object.hasOwn(entry.cardio!,'skipped'),false);
    assert.deepEqual(sessionSchema.parse(workout),workout);
    assert.equal(completedEntries(workout),1);assert.equal(recordedEntries(workout),1);
    const explicit=structuredClone(entry);explicit.cardio={...explicit.cardio!,skipped:false};
    assert.deepEqual(entrySchema.parse(explicit),explicit);
    for(const key of tracking==='treadmill'?['durationMinutes','speedKmh'] as const:['durationMinutes'] as const){
      for(const value of ['', '0']){
        const invalid=structuredClone(explicit);invalid.cardio![key]=value;
        assert.equal(entrySchema.safeParse(invalid).success,false,`${tracking}: ${key}=${value}`);
      }
    }
  }
});
test('zero cardio is valid only for explicitly skipped treadmill records, draft or confirmed',()=>{
  for(const done of [false,true]){
    const workout=skipped(done);const entry=workout.exercises[0];
    assert.deepEqual(entrySchema.parse(entry),entry);
    assert.deepEqual(sessionSchema.parse(workout),workout);
    for(const flag of [undefined,false]){
      const invalid=structuredClone(entry);
      if(flag===undefined) delete invalid.cardio!.skipped;
      else invalid.cardio!.skipped=flag;
      invalid.cardio!.done=true;
      assert.equal(entrySchema.safeParse(invalid).success,false,`zero treadmill without skipped=true: ${flag}`);
    }
    const bike=structuredClone(entry);bike.exercise.tracking='bike';
    assert.equal(entrySchema.safeParse(bike).success,false,`skipped bike: done=${done}`);
  }
  const unconfirmed=skipped(false);unconfirmed.finished=true;
  assert.equal(sessionSchema.safeParse(unconfirmed).success,false);
});
test('skipped treadmill requires exact zero strings and empty hidden bike metrics even in drafts',()=>{
  for(const done of [false,true]){
    const entry=skipped(done).exercises[0];
    for(const key of ['durationMinutes','speedKmh','inclinePercent'] as const){
      for(const value of ['', '1', '0.0', '00', '-0', 'NaN']){
        const invalid=structuredClone(entry);invalid.cardio![key]=value;
        assert.equal(entrySchema.safeParse(invalid).success,false,`${key}=${value}, done=${done}`);
      }
    }
    for(const key of ['resistance','distanceKm','cadenceRpm','watts'] as const){
      for(const value of ['0','1']){
        const invalid=structuredClone(entry);invalid.cardio![key]=value;
        assert.equal(entrySchema.safeParse(invalid).success,false,`hidden ${key}=${value}, done=${done}`);
      }
    }
    const invalid=structuredClone(entry);Object.assign(invalid.cardio!,{skipped:'true'});
    assert.equal(entrySchema.safeParse(invalid).success,false);
  }
});
test('skipped draft and confirmed zero metrics survive a JSON state roundtrip',()=>{
  const data=emptyData();data.templates=[program('treadmill')];
  data.sessions=[skipped(true)];data.draft=skipped(false);
  const loaded=stateSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(loaded,data);
  assert.equal(loaded.sessions[0].exercises[0].cardio!.skipped,true);
  assert.equal(loaded.sessions[0].exercises[0].cardio!.done,true);
  assert.equal(loaded.draft!.exercises[0].cardio!.skipped,true);
  assert.equal(loaded.draft!.exercises[0].cardio!.done,false);
});
test('treadmill participation toggles immutably and resets skipped values to empty cardio',()=>{
  const entry=finished('treadmill').exercises[0];entry.cardio!.done=false;
  Object.assign(entry.cardio!,{resistance:'8',distanceKm:'4',cadenceRpm:'80',watts:'120'});
  const before=structuredClone(entry);
  const omitted=setTreadmillParticipation(entry,false);
  assert.notStrictEqual(omitted,entry);assert.notStrictEqual(omitted.cardio,entry.cardio);
  assert.deepEqual(entry,before);
  assert.deepEqual(omitted,{...before,cardio:{...emptyCardio(),durationMinutes:'0',speedKmh:'0',inclinePercent:'0',skipped:true,done:false}});
  assert.equal(entrySchema.safeParse(omitted).success,true);
  const omittedBefore=structuredClone(omitted);
  const performed=setTreadmillParticipation(omitted,true);
  assert.notStrictEqual(performed,omitted);assert.notStrictEqual(performed.cardio,omitted.cardio);
  assert.deepEqual(performed,{...omittedBefore,cardio:emptyCardio()});
  assert.equal(Object.hasOwn(performed.cardio!,'skipped'),false);
  assert.deepEqual(omitted,omittedBefore);
  assert.deepEqual(setTreadmillParticipation(entry,true),before);
});
test('participation selection is a no-op for non-treadmill and locked records',()=>{
  const strength=newWorkout(emptyData().templates[0]).exercises[0];
  const bike=finished('bike').exercises[0];bike.cardio!.done=false;
  const locked=finished('treadmill').exercises[0];
  const lockedSkipped=skipped(true).exercises[0];
  for(const entry of [strength,bike,locked,lockedSkipped]){
    const before=structuredClone(entry);
    for(const performed of [false,true]){
      assert.strictEqual(setTreadmillParticipation(entry,performed),entry);
      assert.deepEqual(entry,before);
    }
  }
});
test('only confirmed skipped summaries show localized status and all three zero metrics',()=>{
  const entry=skipped(true).exercises[0];
  for(const [locale,prefix] of [['id-ID','Tidak dilakukan'],['en-US','Not performed']]){
    const summary=cardioSummary(entry,locale);
    assert.ok(summary.startsWith(prefix),summary);
    for(const metric of ['0 min','0 km/h','0 %']) assert.ok(summary.includes(metric),summary);
  }
  entry.cardio!.done=false;
  assert.equal(cardioSummary(entry,'id-ID'),'Tidak diselesaikan');
  assert.equal(cardioSummary(entry,'en-US'),'Not completed');
  const performed=finished('treadmill').exercises[0];
  assert.equal(cardioSummary(performed,'en-US').includes('Not performed'),false);
  assert.equal(cardioSummary(performed,'id-ID').includes('Tidak dilakukan'),false);
});
test('cardio graphs keep confirmed skipped zero points and status in chronological order, never drafts',()=>{
  const data=emptyData();data.templates=[program('treadmill')];
  const first=finished('treadmill');first.date='2026-01-01T12:00:00.000Z';
  const omitted=skipped(true);omitted.date='2026-01-02T12:00:00.000Z';
  const unconfirmed=skipped(false);unconfirmed.date='2026-01-03T12:00:00.000Z';
  unconfirmed.finished=true;
  const strength=newWorkout(emptyData().templates[0]).exercises[0];
  strength.sets=[{kg:'20',reps:'10',done:true}];unconfirmed.exercises.push(strength);
  const last=finished('treadmill');last.date='2026-01-04T12:00:00.000Z';
  const unfinished=skipped(true);unfinished.finished=false;unfinished.date='2026-01-05T12:00:00.000Z';
  data.sessions=[last,unconfirmed,omitted,unfinished,first];data.draft=skipped(false);
  const before=structuredClone(data);
  const charts=cardioProgress(data,'treadmill');assert.equal(charts.length,1);
  const points=charts[0].points;
  assert.deepEqual(points.map(point=>point.date),[first.date,omitted.date,last.date]);
  assert.deepEqual(points.map(point=>Number(point.cardio.durationMinutes)),[20.5,0,20.5]);
  assert.deepEqual(points.map(point=>point.cardio.skipped===true),[false,true,false]);
  assert.ok(points.every(point=>point.cardio.done));
  assert.deepEqual(points[1].cardio,omitted.exercises[0].cardio);
  assert.equal(Number(points[1].cardio.speedKmh),0);assert.equal(Number(points[1].cardio.inclinePercent),0);
  assert.deepEqual(data,before);
});
test('skipped cardio is recorded but excluded from completed exercise and share totals',()=>{
  const workout=skipped(true);
  assert.equal(completedEntries(workout),0);assert.equal(recordedEntries(workout),1);
  assert.equal(totalEntries(workout),1);assert.equal(completedSets(workout),0);
  assert.equal(cardioMinutes(workout),0);assert.equal(volume(workout),0);
  assert.deepEqual(shareSummary(workout),{name:workout.name,date:workout.date,exerciseCount:0,setCount:0,cardioMinutes:0,volume:0,exercises:[]});
  const bike=finished('bike').exercises[0];
  const strength=newWorkout(emptyData().templates[0]).exercises[0];
  strength.sets=[{kg:'20',reps:'10',done:true},{kg:'25',reps:'8',done:true}];
  workout.exercises.push(bike,strength);
  assert.equal(completedEntries(workout),3);assert.equal(recordedEntries(workout),4);
  const share=shareSummary(workout);
  assert.equal(share.exerciseCount,2);assert.equal(share.setCount,2);
  assert.equal(share.cardioMinutes,20.5);assert.equal(share.volume,400);
  assert.deepEqual(share.exercises.map(entry=>entry.name),[bike.exercise.name,strength.exercise.name]);
  workout.exercises[0].cardio!.done=false;
  assert.equal(recordedEntries(workout),3);assert.equal(completedEntries(workout),3);
  assert.deepEqual(shareSummary(workout),share);
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
