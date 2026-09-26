"use client";
import { useEffect, useState } from 'react';
import { remainingSeconds } from '@/lib/training';

type Rest = { deadline: number | null; paused: number; label: string; started: boolean };
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
  function start(label: string) { const time = Date.now(); setNow(time); setRest({ deadline: time + duration * 1000, paused: 0, started: true, label }); }
  function pause() { setRest(r => ({ ...r, paused: r.deadline ? remainingSeconds(r.deadline, Date.now()) : r.paused, deadline: null })); }
  function resume() { const time = Date.now(); setNow(time); setRest(r => ({ ...r, deadline: time + r.paused * 1000, paused: 0 })); }
  function clear() { setRest(idle); try { sessionStorage.removeItem(key); } catch {} }
  return { duration, setDuration, rest, seconds, complete, start, pause, resume, clear };
}

export function RestTimer({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  const { rest, seconds, complete } = timer;
  const displayed = rest.started ? seconds : timer.duration;
  return <section className={`panel rest-timer${complete ? ' rest-complete' : ''}`} aria-label="Timer istirahat">
    <div className="rest-heading"><div><span className="eyebrow">JEDA ANTARSET</span><h3>Timer istirahat</h3></div><output className="rest-clock" aria-label="Sisa waktu istirahat" aria-live="off">{String(Math.floor(displayed / 60)).padStart(2, '0')}:{String(displayed % 60).padStart(2, '0')}</output></div>
    <p role="status">{complete ? 'Istirahat selesai. Siap untuk set berikutnya!' : rest.started ? `${rest.deadline ? 'Istirahat setelah' : 'Dijeda ·'} ${rest.label}` : 'Otomatis mulai saat kamu menandai set selesai.'}</p>
    <div className="rest-controls"><label>Durasi<select value={timer.duration} onChange={e => timer.setDuration(Number(e.target.value))}>{durations.map(s => <option value={s} key={s}>{s < 60 ? `${s} detik` : `${s / 60} menit`}</option>)}</select></label>
    {rest.started && !complete && <button type="button" className="secondary" onClick={rest.deadline ? timer.pause : timer.resume}>{rest.deadline ? 'Jeda' : 'Lanjutkan'}</button>}
    <button type="button" className="secondary" onClick={() => timer.start(rest.label || 'jeda manual')}>{rest.started ? 'Mulai ulang' : 'Mulai timer'}</button>
    {rest.started && <button type="button" className="text-button" onClick={timer.clear}>{complete ? 'Tutup' : 'Lewati'}</button>}</div>
    <small className="muted">Durasi baru berlaku untuk timer berikutnya atau saat mulai ulang.</small>
  </section>;
}
