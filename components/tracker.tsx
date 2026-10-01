"use client";
import ShareCard from '@/components/share-card';
import { useLanguage, LanguagePicker } from '@/components/language';
import { useEffect, useId, useRef, useState } from "react";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { tabForPath, tabRoutes, type AppTab } from '@/lib/routes';
import { previousSession } from '@/lib/training';
import { RestTimer, useRestTimer } from '@/components/rest-timer';
import { programProgress, progressPrograms } from "@/lib/progress";
import { browserClient } from "@/lib/supabase/client";
import { registerSummary } from "@/lib/webmcp";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Home,
  Layers,
  LogOut,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  X,
} from "lucide-react";
import {
  emptyData,
  volume,
  completedSets,
  exerciseKey,
  newWorkout,
  stateSchema,
  type Data,
  type Template,
  type Workout,
  type Exercise,
} from "@/lib/model";
const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Tab = AppTab;
function download(data: Data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `replog-${localDay()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Tracker({
  demo,
  direct = false,
  name,
  email,
}: {
  demo: boolean;
  direct?: boolean;
  name: string;
  email: string;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const [sharing,setSharing] = useState<{workout:Workout;sample?:boolean}|null>(null);
  const [data, setData] = useState<Data>(emptyData);
  const [demoTab, setDemoTab] = useState<Tab>('Beranda');
  const pathname = usePathname();
  const router = useRouter();
  const tab = demo ? demoTab : tabForPath(pathname);
  function setTab(next: Tab) {
    if (demo) setDemoTab(next);
    else router.push(tabRoutes[next]);
  }
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Memuat catatan…");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const latestData = useRef(data);
  useEffect(() => {
    latestData.current = data;
  }, [data]);
  useEffect(() => {
    if (loaded) return registerSummary(() => latestData.current);
  }, [loaded]);
  const revision = useRef(0);
  const initial = useRef(true);
  const queue = useRef(Promise.resolve());
  const conflict = useRef(false);
  const dirty = useRef(false);
  const version = useRef(0);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        let next: Data;
        if (demo) {
          const raw = localStorage.getItem("replog-demo-v1");
          next = raw ? stateSchema.parse(JSON.parse(raw)) : emptyData();
        } else if (direct) {
          const client = browserClient();
          const { data: identity, error: identityError } = await client.auth.getUser();
          if (identityError || !identity.user) throw Error("Sesi login tidak ditemukan. Silakan masuk lagi.");
          const permission = await client.rpc("replog_is_allowed");
          if (permission.error || permission.data !== true) throw Error("Akun belum diizinkan mengakses catatan.");
          const { data: row, error: rowError } = await client.from("workout_state").select("data,revision").eq("user_id", identity.user.id).maybeSingle();
          if (rowError) throw rowError;
          next = stateSchema.parse(row?.data ?? emptyData());
          revision.current = row?.revision ?? 0;
        } else {
          const res = await fetch("/api/data", { cache: "no-store" });
          const body = await res.json();
          if (!res.ok) throw Error(body.error);
          next = stateSchema.parse(body.data);
          revision.current = body.revision;
        }
        if (live) {
          setData(next);
          setStatus(
            demo ? "Tersimpan di perangkat ini" : "Semua perubahan tersimpan",
          );
          setLoaded(true);
          setReady(true);
        }
      } catch (e) {
        if (live) {
          setError(
            e instanceof Error ? e.message : "Catatan belum dapat dimuat.",
          );
          setReady(true);
        }
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [demo, direct]);
  useEffect(() => {
    if (!loaded) return;
    if (initial.current) {
      initial.current = false;
      return;
    }
    dirty.current = true;
    const mine = ++version.current;
    setStatus("Menyimpan…");
    const timer = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (conflict.current) return;
        try {
          stateSchema.parse(data);
          if (demo) {
            localStorage.setItem("replog-demo-v1", JSON.stringify(data));
          } else if (direct) {
            const result = await browserClient().rpc("replog_save_state", { expected_revision: revision.current, new_data: data });
            if (result.error) {
              if (result.error.code === "40001") conflict.current = true;
              throw Error(result.error.message || "Catatan belum dapat disimpan.");
            }
            revision.current = result.data;
          } else {
            const res = await fetch("/api/data", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data, revision: revision.current }),
            });
            const body = await res.json();
            if (!res.ok) {
              if (res.status === 409) conflict.current = true;
              throw Error(body.error);
            }
            revision.current = body.revision;
          }
          if (mine === version.current) {
            dirty.current = false;
            setError("");
            setStatus(
              demo ? "Tersimpan di perangkat ini" : "Semua perubahan tersimpan",
            );
          }
        } catch (e) {
          setStatus("Belum tersimpan");
          setError(
            e instanceof Error ? e.message : "Gagal menyimpan. Coba lagi.",
          );
        }
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [data, loaded, demo, direct, retry]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, []);
  const now = new Date();
  const scheduled = data.templates.find((t) => t.day === now.getDay());
  const activeTemplate = data.draft
    ? data.templates.find((t) => t.id === data.draft!.templateId)
    : scheduled;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = data.sessions.filter(
    (s) => new Date(s.date) >= monday && new Date(s.date) <= now,
  );
  const recent = [...data.sessions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  function start(t: Template) {
    if (data.draft) {
      setTab("Latihan");
      return;
    }
    const prev = recent.find((w) => w.templateId === t.id);
    setData((d) => ({ ...d, draft: newWorkout(t, prev) }));
    setTab("Latihan");
  }
  function updateDraft(w: Workout) {
    setData((d) => ({ ...d, draft: w }));
  }
  const nav = [
    { label: "Beranda", icon: Home },
    { label: "Latihan", icon: Dumbbell },
    { label: "Progress", icon: TrendingUp },
    { label: "Riwayat", icon: Layers },
    { label: "Profil", icon: User },
  ] as const;
  if (!ready)
    return (
      <main className="loading">
        <Dumbbell />
        <p>{tr("Menyiapkan ruang latihanmu…")}</p>
      </main>
    );
  return (
    <div className="app-shell">
      {sharing && <ShareCard workout={sharing.workout} sample={sharing.sample} onClose={()=>setSharing(null)}/>}
      <aside className="sidebar">
        <a
          className="brand"
          href={demo ? "/demo" : "/"}
          aria-label={tr("RepLog beranda")}
        >
          <span className="brand-mark">
            <Dumbbell />
          </span>{tr(" rep")}<span>{tr("log")}</span>
        </a>
        <p className="nav-caption">{tr("RUANG LATIHAN")}</p>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <Link
              key={label}
              href={demo ? '/demo' : tabRoutes[label]}
              aria-current={tab === label ? 'page' : undefined}
              className={tab === label ? "nav-item active" : "nav-item"}
              onClick={event => { if (demo) { event.preventDefault(); setDemoTab(label); } }}
            >
              <Icon size={20} />
              <span>{tr(label)}</span>
              {tab === label && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="side-note">
          <div className="mini-icon">
            <Target size={20} />
          </div>
          <strong>{tr("Satu set lebih dekat.")}</strong>
          <p>{tr(" Catat usahamu. ")}<br />{tr(" Bangun konsistensimu. ")}</p>
          <span>{tr("YOUR PACE. YOUR PROGRESS.")}</span>
        </div>
        <div className="side-user">
          <div className="avatar">{tr(name.slice(0, 1).toUpperCase())}</div>
          <div>
            <strong>{tr(name.split(" ")[0])}</strong>
            <small>{tr(demo ? "Mode pratinjau" : "Akun pribadi")}</small>
          </div>
          <ShieldCheck size={18} />
        </div>
      </aside>
      <div className="main-shell">
        <main className="content">
          {demo && (
            <div className="demo-banner"><button type="button" className="text-button" onClick={()=>{const sample=newWorkout(data.templates[1] || data.templates[0]); sample.finished=true; sample.exercises=sample.exercises.map(e=>({...e,sets:e.sets.map(()=>({kg:'20',reps:'10',done:true}))}));setSharing({workout:sample,sample:true});}}>{locale==='en-US'?'Preview share card':'Contoh kartu berbagi'}</button>
              <span>
                <b>{tr("Mode pratinjau")}</b>{tr(" · Catatan di sini tersimpan hanya di browser ini. ")}</span>
              <a href="/login">{tr(" Login online ")}<ArrowUpRight size={14} />
              </a>
            </div>
          )}
          {tr(error && (
            <div className="error" role="alert">
              {tr(error)}
              <div className="button-row">
                {loaded && !conflict.current && (
                  <button
                    className="secondary"
                    onClick={() => setRetry((x) => x + 1)}
                  >{tr(" Coba simpan lagi ")}</button>
                )}
                {loaded && (
                  <button className="secondary" onClick={() => download(data)}>{tr(" Ekspor cadangan ")}</button>
                )}
                <button
                  className="secondary"
                  onClick={() => window.location.reload()}
                >{tr(" Muat ulang ")}</button>
              </div>
            </div>
          ))}
          {!loaded ? (
            <p>{tr("Catatan belum dimuat. Muat ulang untuk mencoba kembali.")}</p>
          ) : (
            <>

              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {tr(tab === "Beranda"
                      ? "LET’S SHOW UP"
                      : tab === "Latihan"
                        ? "MAKE EVERY REP COUNT"
                        : tab === "Progress"
                          ? "SMALL STEPS. REAL PROGRESS."
                          : tab === 'Riwayat' ? 'EVERY SESSION COUNTS' : "YOUR PERSONAL SPACE")}
                  </div>
                  <h1>
                    {tr(tab === "Beranda"
                      ? `Siap untuk set berikutnya${name === "Atlet" ? "" : `, ${name.split(" ")[0]}`}?`
                      : tab === "Latihan"
                        ? "Waktunya latihan."
                        : tab === "Progress"
                          ? "Lihat sejauh apa kamu melangkah."
                          : tab === 'Riwayat' ? 'Setiap sesi punya cerita.' : "Ruangmu, caramu.")}
                  </h1>
                  <p>
                    {tr(tab === "Beranda"
                      ? "Sedikit lebih kuat. Sedikit lebih konsisten. Setiap sesi berarti."
                      : tab === "Latihan"
                        ? "Pilih sesi, catat set, dan lanjutkan progressmu."
                        : tab === "Progress"
                          ? "Bandingkan gerakan yang sama dari sesi ke sesi."
                          : tab === 'Riwayat' ? 'Buka kembali, edit, dan kelola latihan yang sudah selesai.' : "Sesuaikan jadwal dan kelola catatan pribadimu.")}
                  </p>
                </div>
                <span className="date-pill">
                  {tr(now.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }))}
                </span>
              </div>
              {tab === "Beranda" && (
                <>
                  <section className="stats-grid">
                    <Stat
                      icon={<Activity />}
                      label="Sesi minggu ini"
                      value={String(week.length).padStart(2, "0")}
                      unit={`/ ${data.templates.length}`}
                      foot="Sesi latihan selesai"
                    />
                    <Stat
                      icon={<Layers />}
                      label="Total set minggu ini"
                      value={fmt(
                        week.reduce((a, w) => a + completedSets(w), 0),
                      )}
                      foot="Set yang sudah kamu tuntaskan"
                    />
                    <Stat
                      icon={<Dumbbell />}
                      label="Volume minggu ini"
                      value={fmt(week.reduce((a, w) => a + volume(w), 0))}
                      unit="kg"
                      foot="Beban × repetisi seluruh set"
                    />
                    <Stat
                      icon={<Flame />}
                      label="Total latihan"
                      value={String(data.sessions.length).padStart(2, "0")}
                      foot="Setiap sesi adalah kemajuan"
                    />
                  </section>
                  <div className="dashboard-grid">
                    <section className="today-card">
                      <div className="card-top">
                        <span className="eyebrow">
                          {tr(data.draft ? "LANJUTKAN SESIMU" : "SESI HARI INI")}
                        </span>
                        <span className="tag">{tr(days[now.getDay()])}</span>
                      </div>
                      <h2>
                        {tr(data.draft?.name ??
                          scheduled?.name ??
                          "Rest & recover")}
                      </h2>
                      <p>
                        {tr(activeTemplate?.focus ??
                          "Beri ruang untuk istirahat. Sesi lain tetap bisa kamu pilih.")}
                      </p>
                      <div className="session-meta">
                        <span>
                          <Dumbbell size={17} />
                          {data.draft?.exercises.length ??
                            scheduled?.exercises.length ??
                            0}{tr(" ")}{tr(" gerakan ")}</span>
                        <span>
                          <Target size={17} />
                          {tr(data.draft
                            ? "Draf tersimpan"
                            : scheduled
                              ? "Sesuai jadwalmu"
                              : "Hari istirahat")}
                        </span>
                      </div>
                      <button
                        className="primary"
                        onClick={() =>
                          data.draft
                            ? setTab("Latihan")
                            : scheduled
                              ? start(scheduled)
                              : setTab("Latihan")
                        }
                      >
                        {tr(data.draft
                          ? "Lanjutkan latihan"
                          : scheduled
                            ? "Mulai latihan"
                            : "Pilih sesi latihan")}
                        <ArrowRight size={19} />
                      </button>
                      <div className="big-number" aria-hidden="true">
                        {tr(data.draft
                          ? "GO"
                          : scheduled?.name === "Push"
                            ? "02"
                            : scheduled?.name === "Pull"
                              ? "01"
                              : scheduled?.name === "Legs"
                                ? "03"
                                : "↗")}
                      </div>
                    </section>
                    <section className="panel week-panel">
                      <div className="section-title">
                        <h2>{tr("Ritme minggu ini")}</h2>
                        <span className="muted">{week.length}{tr(" sesi")}</span>
                      </div>
                      <div className="week-days">
                        {[1, 2, 3, 4, 5, 6, 0].map((day, i) => {
                          const dayDate = new Date(monday);
                          dayDate.setDate(dayDate.getDate() + i);
                          const done = week.some(
                            (w) =>
                              localDay(new Date(w.date)) === localDay(dayDate),
                          );
                          return (
                            <div
                              key={day}
                              className={
                                day === now.getDay() ? "day current" : "day"
                              }
                            >
                              <span>{tr(days[day].slice(0, 3))}</span>
                              <b
                                className={
                                  done ? "day-circle done" : "day-circle"
                                }
                              >
                                {done ? <Check size={17} /> : dayDate.getDate()}
                              </b>
                              <small>
                                {tr(data.templates.some((t) => t.day === day)
                                  ? "Latihan"
                                  : "Rest")}
                              </small>
                            </div>
                          );
                        })}
                      </div>
                      <div className="week-footer">
                        <span className="legend-dot" />{tr(" Latihan selesai")}{tr(" ")}
                        <span className="muted">{tr(" Konsistensi dimulai dari hadir. ")}</span>
                      </div>
                    </section>
                  </div>
                  <section className="section-block">
                    <div className="section-title">
                      <h2>{tr(" Program latihanmu")}{tr(" ")}
                        <span className="count">{data.templates.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("Latihan")}
                      >{tr(" Lihat semua ")}<ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="program-grid">
                      {data.templates.map((t, i) => (
                        <button
                          className="program-card"
                          key={t.id}
                          onClick={() => start(t)}
                        >
                          <span className="program-index">
                            0{i + 1} <ArrowUpRight size={17} />
                          </span>
                          <span className="program-day">{tr(days[t.day])}</span>
                          <strong>{t.name}</strong>
                          <span className="muted">
                            {t.exercises.length}{tr(" gerakan · ")}{tr(t.focus)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-title">
                      <h2>{tr("Latihan terakhir")}</h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("Progress")}
                      >{tr(" Riwayat lengkap ")}<ArrowRight size={16} />
                      </button>
                    </div>
                    {recent.length ? (
                      recent.slice(0, 3).map((w) => (
                        <div className="history-row" key={w.id}>
                          <span className="mini-icon">
                            <Dumbbell size={20} />
                          </span>
                          <div>
                            <strong>{w.name}</strong>
                            <small>
                              {tr(dateLabel(w.date))} · {completedSets(w)}{tr(" set selesai ")}</small>
                          </div>
                          <b>
                            {tr(fmt(volume(w)))} <small>{tr("kg volume")}</small>
                          </b>
                          <Check size={18} className="lime" />
                        </div>
                      ))
                    ) : (
                      <div className="empty-inline">
                        <span className="mini-icon">
                          <Dumbbell size={22} />
                        </span>
                        <div>
                          <strong>{tr("Halaman baru untuk progressmu.")}</strong>
                          <p>{tr(" Selesaikan sesi pertama untuk melihat riwayat di sini. ")}</p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setTab("Latihan")}
                        >{tr(" Mulai sesi ")}<ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === "Latihan" &&
                (data.draft ? (
                  <WorkoutEditor
                    key={data.draft.id}
                    workout={data.draft}
                    history={recent.filter((s) => s.id !== data.draft?.id)}
                    onChange={updateDraft}
                    onFinish={() => {
                      const w = data.draft!;
                      if (!completedSets(w)) {
                        setError(
                          "Selesaikan minimal satu set dengan beban dan repetisi yang valid.",
                        );
                        return;
                      }
                      setData((d) => ({
                        ...d,
                        draft: null,
                        sessions: [
                          { ...w, finished: true },
                          ...d.sessions.filter((s) => s.id !== w.id),
                        ],
                      }));
                      setSharing({workout:{...w,finished:true}});
                      setTab("Riwayat");
                    }}
                    onDiscard={() => {
                      if (confirm(tr("Hapus draf latihan ini?")))
                        setData((d) => ({ ...d, draft: null }));
                    }}
                  />
                ) : (
                  <div className="template-list">
                    {data.templates.map((t, i) => (
                      <section className="panel template-card" key={t.id}>
                        <div className="section-title">
                          <div>
                            <span className="eyebrow">
                              {tr(days[t.day])} / 0{i + 1}
                            </span>
                            <h2>{t.name}</h2>
                            <p>{tr(t.focus)}</p>
                          </div>
                          <button className="primary" onClick={() => start(t)}>{tr(" Mulai ")}<ArrowRight size={17} />
                          </button>
                        </div>
                        <div className="exercise-preview">
                          {t.exercises.map((e) => (
                            <div key={e.id}>
                              <span>{e.name}</span>
                              <small>
                                {tr(e.minSets === e.maxSets
                                  ? e.minSets
                                  : `${e.minSets}–${e.maxSets}`)}{tr(" ")}
                                × {e.minReps}–{e.maxReps}
                              </small>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ))}
              {(tab === "Progress" || tab === "Riwayat") && (
                <Progress
                  historyOnly={tab === 'Riwayat'}
                  onShare={w=>setSharing({workout:w})}
                  data={data}
                  onEdit={(w) => {
                    if (data.draft) {
                      setError(
                        "Selesaikan atau hapus draf aktif sebelum mengedit riwayat.",
                      );
                      return;
                    }
                    setData((d) => ({
                      ...d,
                      draft: { ...structuredClone(w), finished: false },
                    }));
                    setTab("Latihan");
                  }}
                  onDelete={(id) => {
                    if (confirm(tr("Hapus sesi ini dari riwayat?")))
                      setData((d) => ({
                        ...d,
                        sessions: d.sessions.filter((w) => w.id !== id),
                      }));
                  }}
                />
              )}
              {tab === "Profil" && (
                <Profile
                  data={data}
                  onChange={setData}
                  name={name}
                  email={email}
                  demo={demo}
                />
              )}
            </>
          )}
          <footer className="footer">
            <span className="save-state" role="status">
              <span />
              {tr(status)}
            </span>
            <span>{tr(" REPLOG ")}<span className="muted">{tr("/ BUILT ONE REP AT A TIME")}</span>
            </span>
            <span>
              <ShieldCheck size={14} />{tr(" Catatan pribadi ")}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  unit,
  foot,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  foot: string;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  return (
    <article className="stat">
      <div className="stat-label">
        {tr(label)}
        <span>{tr(icon)}</span>
      </div>
      <div className="stat-value">
        {tr(value)} <small>{tr(unit)}</small>
      </div>
      <p>{tr(foot)}</p>
    </article>
  );
}
function WorkoutEditor({
  workout: w,
  history,
  onChange,
  onFinish,
  onDiscard,
}: {
  workout: Workout;
  history: Workout[];
  onChange: (w: Workout) => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const [message, setMessage] = useState("");
  const timer = useRestTimer(w.id);
  const previous = previousSession(history, w);
  function setAt(
    ei: number,
    si: number,
    field: "kg" | "reps" | "done",
    value: string | boolean,
  ) {
    const next = structuredClone(w);
    const set = next.exercises[ei].sets[si];
    if (field === "done") {
      if (
        value &&
        (set.kg === "" ||
          set.reps === "" ||
          Number(set.kg) < 0 ||
          Number(set.reps) <= 0)
      ) {
        setMessage(
          "Isi beban (boleh 0) dan repetisi sebelum menandai set selesai.",
        );
        return;
      }
      if (value && !set.done) timer.start(`${next.exercises[ei].exercise.name} · set ${si + 1}`);
      set.done = Boolean(value);
    } else {
      set[field] = String(value);
      set.done = false;
    }
    setMessage("");
    onChange(next);
  }
  return (
    <div className="workout-layout">
      <div className="workout-main">
        <div className="panel session-heading">
          <div>
            <span className="eyebrow">{tr("SESI AKTIF · ")}{tr(dateLabel(w.date))}</span>
            <h2>{w.name}</h2>
          </div>
          <span className="tag lime">
            {completedSets(w)} /{tr(" ")}
            {w.exercises.reduce((a, e) => a + e.sets.length, 0)}{tr(" set ")}</span>
        </div>
        {tr(message && (
          <p role="alert" className="error">
            {tr(message)}
          </p>
        ))}
        <RestTimer timer={timer} />
        <div className="previous-session panel"><Activity size={20}/><div><strong>{tr(previous ? `Acuan ${previous.name} terakhir · ${new Date(previous.date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}` : `Sesi ${w.name} pertamamu`)}</strong><p>{tr(previous ? 'Beban dan repetisi set yang selesai ditampilkan di setiap gerakan. Gunakan sebagai acuan, lalu isi hasil latihan hari ini.' : 'Belum ada sesi sebelumnya. Catatan hari ini akan menjadi acuan latihan berikutnya.')}</p></div></div>
        {w.exercises.map((item, ei) => {
          const e = item.exercise;
          const last = previous?.exercises.find(h => exerciseKey(h.exercise) === exerciseKey(e));
          return (
            <section className="panel exercise-card" key={ei}>
              <div className="exercise-head">
                <span className="exercise-number">
                  {tr(String(ei + 1).padStart(2, "0"))}
                </span>
                <div>
                  <h3>{e.name}</h3>
                  <p>
                    {tr(e.kind === "C" ? "Compound" : "Isolation")}{tr(" · Target")}{tr(" ")}
                    {e.minSets}–{e.maxSets}{tr(" set × ")}{e.minReps}–{e.maxReps}{tr(" rep ")}</p>
                </div>
              </div>
              {e.alternatives.length > 0 && (
                <label className="variant-label">{tr(" Variasi gerakan ")}<select
                    value={e.name}
                    onChange={(ev) => {
                      if (
                        item.sets.some((s) => s.done || s.kg || s.reps) &&
                        !confirm(
                          tr("Ganti variasi? Isian set gerakan ini akan dikosongkan."),
                        )
                      )
                        return;
                      const next = structuredClone(w);
                      next.exercises[ei].exercise = {
                        ...e,
                        name: ev.target.value,
                        alternatives: [e.name, ...e.alternatives].filter(
                          (x) => x !== ev.target.value,
                        ),
                      };
                      next.exercises[ei].sets = item.sets.map(() => ({
                        kg: "",
                        reps: "",
                        done: false,
                      }));
                      onChange(next);
                    }}
                  >
                    {[e.name, ...e.alternatives].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="previous">
                <Activity size={15} />
                <span>{tr(" Sesi sebelumnya:")}{tr(" ")}
                  {tr(last
                    ? last.sets
                        .map((s, i) => s.done ? `Set ${i + 1}: ${s.kg} kg × ${s.reps} rep` : null)
                        .filter(Boolean)
                        .join(" · ") || "Belum ada set selesai"
                    : "Belum ada catatan")}
                </span>
              </div>
              <div className="set-header">
                <span>{tr("SET")}</span>
                <span>{tr("BEBAN (KG)")}</span>
                <span>{tr("REPETISI")}</span>
                <span>{tr("SELESAI")}</span>
                <span />
              </div>
              {item.sets.map((s, si) => (
                <div
                  className={s.done ? "set-row completed" : "set-row"}
                  key={si}
                >
                  <b>{si + 1}</b>
                  <input
                    aria-label={tr(`${e.name} set ${si + 1} beban`)}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1500"
                    step="0.5"
                    placeholder={tr("0")}
                    value={s.kg}
                    onChange={(ev) => {
                      if (
                        ev.target.value === "" ||
                        (/^[0-9]+(\.[0-9]+)?$/.test(ev.target.value) &&
                          Number(ev.target.value) <= 1500)
                      )
                        setAt(ei, si, "kg", ev.target.value);
                    }}
                  />
                  <input
                    aria-label={tr(`${e.name} set ${si + 1} repetisi`)}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="1000"
                    placeholder={tr(String(e.minReps))}
                    value={s.reps}
                    onChange={(ev) => {
                      if (
                        ev.target.value === "" ||
                        (/^\d+$/.test(ev.target.value) &&
                          Number(ev.target.value) <= 1000)
                      )
                        setAt(ei, si, "reps", ev.target.value);
                    }}
                  />
                  <button
                    className={s.done ? "check-set checked" : "check-set"}
                    aria-label={tr(`${e.name} set ${si + 1} selesai`)}
                    aria-pressed={s.done}
                    onClick={() => setAt(ei, si, "done", !s.done)}
                  >
                    <Check size={19} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={item.sets.length <= 1}
                    aria-label={tr(`Hapus ${e.name} set ${si + 1}`)}
                    onClick={() => {
                      if (
                        (s.done || s.kg || s.reps) &&
                        !confirm(tr("Hapus set beserta isinya?"))
                      )
                        return;
                      const next = structuredClone(w);
                      next.exercises[ei].sets.splice(si, 1);
                      onChange(next);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button
                className="add-set"
                disabled={item.sets.length >= 10}
                onClick={() => {
                  const next = structuredClone(w);
                  next.exercises[ei].sets.push({
                    kg: "",
                    reps: "",
                    done: false,
                  });
                  onChange(next);
                }}
              >
                <Plus size={16} />{tr(" Tambah set ")}</button>
            </section>
          );
        })}
      </div>
      <aside className="workout-summary panel">
        <span className="eyebrow">{tr("RINGKASAN SESI")}</span>
        <h2>{w.name}</h2>
        <div className="summary-number">
          {completedSets(w)} <small>{tr("set selesai")}</small>
        </div>
        <div className="progress-track">
          <span
            style={{
              width: `${(completedSets(w) / w.exercises.reduce((a, e) => a + e.sets.length, 0)) * 100}%`,
            }}
          />
        </div>
        <div className="summary-line">
          <span>{tr("Volume latihan")}</span>
          <b>{tr(fmt(volume(w)))}{tr(" kg")}</b>
        </div>
        <label>{tr(" Catatan sesi ")}<textarea
            maxLength={2000}
            placeholder={tr("Bagaimana latihanmu hari ini?")}
            value={w.notes}
            onChange={(ev) => onChange({ ...w, notes: ev.target.value })}
          />
        </label>
        <p className="hint">{tr(" Tandai set yang selesai. Grafik hanya menghitung set yang ditandai. ")}</p>
        <button className="primary" onClick={() => { if (completedSets(w)) timer.clear(); onFinish(); }}>
          <Check size={18} />{tr(" Selesaikan latihan ")}</button>
        <button className="text-button danger" onClick={onDiscard}>
          <Trash2 size={15} />{tr(" Hapus draf ")}</button>
        <p className="hint">{tr(" Dumbbell: kg per tangan. Barbell: termasuk batang. Gunakan penamaan yang sama untuk mesin yang sama. ")}</p>
      </aside>
    </div>
  );
}
function Progress({
  data,
  onShare,
  historyOnly = false,
  onEdit,
  onDelete,
}: {
  data: Data;
  onShare: (w:Workout)=>void;
  historyOnly?: boolean;
  onEdit: (w: Workout) => void;
  onDelete: (id: string) => void;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const programs = progressPrograms(data);
  const [selected, setSelected] = useState(programs[0]?.id ?? "");
  const programId = programs.some(p => p.id === selected) ? selected : programs[0]?.id ?? "";
  const charts = programProgress(data, programId);
  return (
    <>
      {!historyOnly && <section className="panel chart-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">{tr("PERKEMBANGAN BEBAN")}</span>
            <h2>{tr("Setiap kenaikan berarti.")}</h2>
          </div>
          <div>
            <label htmlFor="progress-program">{tr("Jenis latihan")}</label>
            <select id="progress-program" value={programId} onChange={e => setSelected(e.target.value)}>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <p className="muted">{tr("Beban tertinggi per sesi untuk setiap gerakan · maksimal 12 sesi terakhir dari jenis latihan yang dipilih.")}</p>
        <div className="program-charts">
          {charts.map(chart => (
            <article className="exercise-progress" key={chart.key}>
              <div className="section-title">
                <h3>{chart.name}</h3>
                <span className="tag">{tr("Rekor ")}{tr(chart.best === null ? "—" : fmt(chart.best))}{tr(" kg")}</span>
              </div>
              {chart.points.length ? <Chart points={chart.points} name={chart.name} /> : (
                <div className="chart-empty">
                  <TrendingUp size={28} />
                  <p>{tr("Belum ada set selesai untuk ")}{chart.name}{tr(" pada jenis latihan ini.")}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>}
      {historyOnly && <section className="panel section-block">
        <div className="section-title">
          <h2>{tr("Riwayat latihan")}</h2>
          <span className="tag">{data.sessions.length}{tr(" sesi")}</span>
        </div>
        {data.sessions.length ? (
          [...data.sessions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((w) => (
              <details className="history-detail" key={w.id}>
                <summary>
                  <span className="mini-icon">
                    <Dumbbell size={19} />
                  </span>
                  <span>
                    <strong>{w.name}</strong>
                    <small>
                      {tr(new Date(w.date).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }))}{tr(" ")}
                      · {completedSets(w)}{tr(" set ")}</small>
                  </span>
                  <b>{tr(fmt(volume(w)))}{tr(" kg")}</b>
                  <ChevronRight size={18} />
                </summary>
                <div className="history-body">
                  {w.exercises.map((e, i) => (
                    <p key={i}>
                      <b>{e.exercise.name}</b>
                      <span>
                        {tr(e.sets
                          .filter((s) => s.done)
                          .map((s) => `${s.kg} kg × ${s.reps}`)
                          .join(" / ") || "Tidak diselesaikan")}
                      </span>
                    </p>
                  ))}
                  {tr(w.notes && <p className="notes">{w.notes}</p>)}
                  <div className="button-row">
                    <button type="button" className="secondary" onClick={()=>onShare(w)}>{locale==='en-US'?'Share card':'Bagikan kartu'}</button>
                    <button className="secondary" onClick={() => onEdit(w)}>{tr(" Edit sesi ")}</button>
                    <button
                      className="text-button danger"
                      onClick={() => onDelete(w.id)}
                    >{tr(" Hapus sesi ")}</button>
                  </div>
                </div>
              </details>
            ))
        ) : (
          <div className="empty-inline">
            <Activity />
            <p>{tr(" Belum ada sesi selesai. Catatan pertamamu akan muncul di sini. ")}</p>
          </div>
        )}
      </section>}
    </>
  );
}
function Chart({ points, name }: { points: { date: string; kg: number }[]; name: string }) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const gradientId = useId();
  const max = Math.max(...points.map((p) => p.kg), 10) * 1.15;
  const x = (i: number) => 55 + (i * 600) / Math.max(points.length - 1, 1);
  const y = (kg: number) => 195 - (kg / max) * 160;
  return (
    <div className="chart">
      <svg
        viewBox="0 0 700 245"
        role="img"
        aria-label={tr(`Grafik beban tertinggi per sesi ${name}`)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#c7f76b" stopOpacity=".2" />
            <stop offset="1" stopColor="#c7f76b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="55"
              x2="670"
              y1={195 - i * 40}
              y2={195 - i * 40}
              stroke="#30342c"
              strokeDasharray="4 5"
            />
            <text x="4" y={200 - i * 40} fill="#8c9488" fontSize="12">
              {tr(fmt((max * i) / 4))}
            </text>
          </g>
        ))}
        <path
          d={`M ${x(0)} 195 ${points.map((p, i) => `L ${x(i)} ${y(p.kg)}`).join(" ")} L ${x(points.length - 1)} 195 Z`}
          fill={`url(#${gradientId})`}
        />
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ")}
          fill="none"
          stroke="#c7f76b"
          strokeWidth="3"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.kg)} r="5" fill="#c7f76b">
              <title>
                {tr(dateLabel(p.date))}: {p.kg}{tr(" kg ")}</title>
            </circle>
            {(i % Math.ceil(points.length / 6) === 0 ||
              i === points.length - 1) && (
              <text
                x={x(i)}
                y="230"
                textAnchor="middle"
                fill="#9a9f94"
                fontSize="12"
              >
                {tr(dateLabel(p.date))}
              </text>
            )}
          </g>
        ))}
      </svg>
      <details className="chart-data">
        <summary>{tr("Lihat angka grafik")}</summary>
        {points.map((p, i) => (
          <p key={i}>
            {tr(dateLabel(p.date))}: {tr(fmt(p.kg))}{tr(" kg ")}</p>
        ))}
      </details>
    </div>
  );
}
function Profile({
  data,
  onChange,
  name,
  email,
  demo,
}: {
  data: Data;
  onChange: React.Dispatch<React.SetStateAction<Data>>;
  name: string;
  email: string;
  demo: boolean;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const [editing, setEditing] = useState<Template | null>(null);
  const editorRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing && editorRef.current && !editorRef.current.open)
      editorRef.current.showModal();
  }, [editing]);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(localDay());
  const [notice, setNotice] = useState("");
  function saveTemplate() {
    if (!editing) return;
    const candidate = {
      ...data,
      templates: data.templates.map((t) => (t.id === editing.id ? editing : t)),
    };
    const parsed = stateSchema.safeParse(candidate);
    if (!parsed.success) {
      setNotice(parsed.error.issues[0]?.message ?? "Periksa target latihan.");
      return;
    }
    onChange(parsed.data);
    setEditing(null);
    setNotice(
      "Template diperbarui. Riwayat dan sesi aktif tetap memakai catatan sebelumnya.",
    );
  }
  return (
    <>
      <section className="panel profile-preferences" aria-labelledby="language-heading">
        <div><span className="eyebrow">{locale === 'en-US' ? 'PREFERENCES' : 'PENYESUAIAN'}</span>
        <h2 id="language-heading">{locale === 'en-US' ? 'Display language' : 'Bahasa tampilan'}</h2>
        <p className="muted">{locale === 'en-US' ? 'Applies across RepLog and is saved on this device.' : 'Berlaku di seluruh RepLog dan tersimpan di perangkat ini.'}</p></div>
        <LanguagePicker />
      </section>
      <div className="profile-grid">
        <section className="panel">
          <div className="profile-title">
            <span className="avatar">{tr(name.slice(0, 1).toUpperCase())}</span>
            <div>
              <h2>{name}</h2>
              <p>{email}</p>
            </div>
          </div>
          <p className="privacy">
            <ShieldCheck size={17} />{tr(" ")}
            {tr(demo
              ? "Pratinjau lokal, tidak terhubung ke akun."
              : "Catatan hanya dapat diakses akunmu.")}
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => download(data)}>
              <ArrowDownToLine size={17} />{tr(" Ekspor data JSON ")}</button>
            {!demo && (
              <button
                className="text-button"
                onClick={async () => {
                  const { error } = await browserClient().auth.signOut({
                    scope: "local",
                  });
                  if (error) {
                    setNotice("Belum berhasil keluar. Coba lagi.");
                    return;
                  }
                  window.location.assign("/login");
                }}
              >
                <LogOut size={17} />{tr(" Keluar ")}</button>
            )}
          </div>
        </section>
        <section className="panel">
          <h2>{tr(" Berat badan ")}<span className="count">{tr("Opsional")}</span>
          </h2>
          <form
            className="weight-form"
            onSubmit={(e) => {
              e.preventDefault();
              onChange((d) => ({
                ...d,
                weights: [
                  { id: crypto.randomUUID(), date, kg: Number(weight) },
                  ...d.weights,
                ],
              }));
              setWeight("");
              setNotice("Berat badan dicatat.");
            }}
          >
            <label>{tr(" Tanggal ")}<input
                type="date"
                required
                value={date}
                max={localDay()}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>{tr(" Berat (kg) ")}<input
                type="number"
                required
                min="1"
                max="500"
                step="0.1"
                value={weight}
                placeholder={tr("70")}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
            <button className="primary" aria-label={tr("Simpan berat badan")}>
              <Plus size={19} />
            </button>
          </form>
          {[...data.weights]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((w) => (
              <div className="weight-row" key={w.id}>
                <span>{tr(dateLabel(w.date + "T12:00:00"))}</span>
                <b>{tr(fmt(w.kg))}{tr(" kg")}</b>
                <button
                  className="icon-button"
                  aria-label={tr(`Hapus berat badan ${w.date}`)}
                  onClick={() => {
                    if (confirm(tr("Hapus catatan berat badan ini?")))
                      onChange((d) => ({
                        ...d,
                        weights: d.weights.filter((x) => x.id !== w.id),
                      }));
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </section>
      </div>
      {tr(notice && (
        <p className="notice" role="status">
          {tr(notice)}
        </p>
      ))}
      <section className="panel section-block">
        <div className="section-title">
          <div>
            <h2>{tr("Template & jadwal")}</h2>
            <p>{tr("Perubahan hanya berlaku untuk latihan baru milikmu.")}</p>
          </div>
          <Settings2 size={22} />
        </div>
        {data.templates.map((t) => (
          <div className="template-setting" key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <small>
                {tr(days[t.day])} · {t.exercises.length}{tr(" gerakan ")}</small>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setEditing(structuredClone(t));
                setNotice("");
              }}
            >{tr(" Sesuaikan ")}</button>
          </div>
        ))}
      </section>
      {editing && (
        <dialog
          ref={editorRef}
          onCancel={() => setEditing(null)}
          aria-label={tr("Edit template")}
          className="template-editor panel"
        >
          <div className="section-title">
            <h2>{tr("Sesuaikan ")}{editing.name}</h2>
            <button
              className="icon-button"
              aria-label={tr("Tutup editor")}
              onClick={() => setEditing(null)}
            >
              <X />
            </button>
          </div>
          <label>{tr(" Nama sesi ")}<input
              maxLength={100}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label>{tr(" Hari latihan ")}<select
              value={editing.day}
              onChange={(e) =>
                setEditing({ ...editing, day: Number(e.target.value) })
              }
            >
              {days.map((day, i) => (
                <option value={i} key={day}>
                  {tr(day)}
                </option>
              ))}
            </select>
          </label>
          <div className="hint">{tr(" Target berupa rentang. Contoh: 2–3 set dan 10–12 repetisi. Gunakan nama berbeda untuk mesin atau variasi berbeda. ")}</div>
          {editing.exercises.map((e, i) => (
            <div className="edit-exercise" key={e.id}>
              <div className="edit-name">
                <label>{tr(" Gerakan ")}{i + 1}
                  <input
                    value={e.name}
                    maxLength={100}
                    onChange={(ev) =>
                      setEditing({
                        ...editing,
                        exercises: editing.exercises.map((x, j) =>
                          j === i ? { ...x, name: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label={tr(`Hapus gerakan ${e.name}`)}
                  disabled={editing.exercises.length <= 1}
                  onClick={() =>
                    setEditing({
                      ...editing,
                      exercises: editing.exercises.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="target-fields">
                {(["minSets", "maxSets", "minReps", "maxReps"] as const).map(
                  (field, fi) => (
                    <label key={field}>
                      {tr(["Set min", "Set maks", "Rep min", "Rep maks"][fi])}
                      <input
                        type="number"
                        min="1"
                        max={fi < 2 ? 10 : 100}
                        value={e[field]}
                        onChange={(ev) =>
                          setEditing({
                            ...editing,
                            exercises: editing.exercises.map((x, j) =>
                              j === i
                                ? { ...x, [field]: Number(ev.target.value) }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
          ))}
          <button
            className="secondary"
            disabled={editing.exercises.length >= 30}
            onClick={() =>
              setEditing({
                ...editing,
                exercises: [
                  ...editing.exercises,
                  {
                    id: crypto.randomUUID(),
                    name: "Gerakan baru",
                    kind: "I",
                    minSets: 2,
                    maxSets: 3,
                    minReps: 10,
                    maxReps: 12,
                    alternatives: [],
                  },
                ],
              })
            }
          >
            <Plus size={16} />{tr(" Tambah gerakan ")}</button>
          {tr(notice && (
            <p className="error" role="alert">
              {tr(notice)}
            </p>
          ))}
          <div className="button-row editor-actions">
            <button className="primary" onClick={saveTemplate}>
              <Save size={17} />{tr(" Simpan template ")}</button>
            <button className="secondary" onClick={() => setEditing(null)}>{tr(" Batal ")}</button>
          </div>
        </dialog>
      )}
    </>
  );
}
