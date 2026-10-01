"use client";
import { useLanguage } from '@/components/language';
import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Check, ArrowRight } from 'lucide-react';
import { remainingSeconds } from '@/lib/training';

type Rest = { deadline: number | null; paused: number; label: string; started: boolean; total?: number };
const idle: Rest = { deadline: null, paused: 0, label: '', started: false };
const durations = [30, 45, 60, 90, 120, 180, 300];
export function useRestTimer(workoutId: string) {
  const [duration, setDuration] = useState(90);
  const [rest, setRest] = useState<Rest>(idle);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const key = `replog-rest-${workoutId}`;
  useEffect(() => {
    setNow(Date.now());
    try {
      const savedDuration = Number(localStorage.getItem('replog-rest-duration'));
      if (durations.includes(savedDuration)) setDuration(savedDuration);
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (saved && (saved.deadline === null || Number.isFinite(saved.deadline)) && Number.isFinite(saved.paused) && saved.paused >= 0 && typeof saved.label === 'string' && typeof saved.started === 'boolean') setRest(saved);
    } catch { /* Timer remains usable when browser storage is unavailable. */ }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(key, JSON.stringify(rest)); localStorage.setItem('replog-rest-duration', String(duration)); } catch { /* Optional persistence. */ }
  }, [rest, duration, key, ready]);
  useEffect(() => {
    if (!rest.deadline) return;
    const tick = () => { const time = Date.now(); setNow(time); if (time >= rest.deadline!) clearInterval(timer); };
    const timer = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [rest.deadline]);
  const seconds = rest.deadline ? remainingSeconds(rest.deadline, now) : rest.paused;
  const complete = rest.started && seconds === 0;
  function start(label: string) { const time = Date.now(); setNow(time); setRest({ deadline: time + duration * 1000, paused: 0, started: true, label, total: duration }); }
  function pause() { setRest(r => ({ ...r, paused: r.deadline ? remainingSeconds(r.deadline, Date.now()) : r.paused, deadline: null })); }
  function resume() { const time = Date.now(); setNow(time); setRest(r => ({ ...r, deadline: time + r.paused * 1000, paused: 0 })); }
  function clear() { setRest(idle); try { sessionStorage.removeItem(key); } catch {} }
  function adjust(delta: number) {
    const time = Date.now(); setNow(time);
    setRest(r => { const current = r.deadline ? remainingSeconds(r.deadline, time) : r.paused; const next = Math.max(0, Math.min(3600, current + delta)); return { ...r, deadline: r.deadline ? time + next * 1000 : null, paused: r.deadline ? 0 : next, total: Math.max(r.total || duration, next) }; });
  }
  return { adjust, duration, setDuration, rest, seconds, complete, start, pause, resume, clear };
}

const formatTime = (v: number) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
export function RestTimer({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const { rest, seconds, complete } = timer;
  const paused = rest.started && !rest.deadline && !complete;
  const displayed = rest.started ? seconds : timer.duration;
  const progress = complete ? 1 : Math.min(1, displayed / (rest.total || timer.duration));
  return <section className={`panel rest-timer rest-visual ${paused ? 'is-paused' : ''} ${complete ? 'is-complete' : ''}`} aria-label={tr("Timer istirahat")}>
    <div className="rest-heading"><div><span className="eyebrow">{tr("JEDA ANTARSET")}</span><h3>{tr("Istirahat")}</h3></div><span className="rest-state" role="status">{tr(complete ? 'SELESAI' : paused ? 'DIJEDA' : rest.started ? 'BERJALAN' : 'SIAP')}</span></div>
    <p className="rest-caption">{tr(complete ? 'Siap untuk set berikutnya?' : paused ? 'Lanjutkan saat kamu siap.' : 'Ambil napas, tetap fokus.')}</p>
    <div className="rest-dial"><svg viewBox="0 0 240 240" aria-hidden="true"><circle className="rest-track" cx="120" cy="120" r="106"/><circle className="rest-ring" cx="120" cy="120" r="106" pathLength="1" strokeDasharray="1" strokeDashoffset={1-progress}/></svg><div className="rest-dial-content">{complete ? <><Check size={44}/><strong>{tr("Selesai!")}</strong></> : <>{paused && <Pause size={26}/>}<output aria-label={tr("Sisa waktu istirahat")} className="rest-clock">{tr(formatTime(displayed))}</output><small>{tr(paused ? 'Timer dijeda' : `dari ${formatTime(rest.started ? rest.total || timer.duration : timer.duration)}`)}</small></>}</div></div>
    <div className="rest-context"><small>{tr(rest.label ? 'Set terakhir selesai' : 'Siap latihan')}</small><strong>{tr(rest.label || 'Timer otomatis setelah set selesai')}</strong></div>
    {rest.started && !complete && <div className="rest-adjust"><button onClick={() => timer.adjust(-15)} type="button">{tr("−15 dtk")}</button><button onClick={() => timer.adjust(15)} type="button">{tr("+15 dtk")}</button></div>}
    <div className="rest-actions">{complete ? <button className="rest-primary" type="button" onClick={timer.clear}><ArrowRight size={20}/>{tr("Kembali ke latihan")}</button> : <button className="rest-primary" type="button" onClick={!rest.started ? () => timer.start('Jeda manual') : paused ? timer.resume : timer.pause}>{rest.started && !paused ? <Pause size={20}/> : <Play size={20}/>} {tr(!rest.started ? 'Mulai timer' : paused ? 'Lanjut' : 'Jeda')}</button>}
    {rest.started && <div className="rest-adjust"><button type="button" onClick={() => timer.start(rest.label)}><RotateCcw size={17}/>{tr("Ulangi")}</button>{!complete && <button type="button" onClick={timer.clear}><SkipForward size={17}/>{tr("Lewati")}</button>}</div>}</div>
    <div className="rest-presets"><label htmlFor="rest-duration">{tr("Durasi istirahat")}</label><div>{[60,90,120,180].map(value => <button key={value} type="button" aria-pressed={timer.duration === value} onClick={() => timer.setDuration(value)}>{value}{tr(" dtk")}</button>)}</div><select id="rest-duration" aria-label={tr("Pilihan durasi lainnya")} value={timer.duration} onChange={e => timer.setDuration(Number(e.target.value))}>{durations.map(value => <option key={value} value={value}>{value}{tr(" detik")}</option>)}</select><small>{tr("Durasi berlaku saat mulai atau ulangi timer.")}</small></div>
  </section>;
}
