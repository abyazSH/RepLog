"use client";
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
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n);
const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
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
        <p>Menyiapkan ruang latihanmu…</p>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href={demo ? "/demo" : "/"}
          aria-label="RepLog beranda"
        >
          <span className="brand-mark">
            <Dumbbell />
          </span>
          rep<span>log</span>
        </a>
        <p className="nav-caption">RUANG LATIHAN</p>
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
              <span>{label}</span>
              {tab === label && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="side-note">
          <div className="mini-icon">
            <Target size={20} />
          </div>
          <strong>Satu set lebih dekat.</strong>
          <p>
            Catat usahamu.
            <br />
            Bangun konsistensimu.
          </p>
          <span>YOUR PACE. YOUR PROGRESS.</span>
        </div>
        <div className="side-user">
          <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{name.split(" ")[0]}</strong>
            <small>{demo ? "Mode pratinjau" : "Akun pribadi"}</small>
          </div>
          <ShieldCheck size={18} />
        </div>
      </aside>
      <div className="main-shell">
        <main className="content">
          {demo && (
            <div className="demo-banner">
              <span>
                <b>Mode pratinjau</b> · Catatan di sini tersimpan hanya di
                browser ini.
              </span>
              <a href="/login">
                Login online <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <div className="button-row">
                {loaded && !conflict.current && (
                  <button
                    className="secondary"
                    onClick={() => setRetry((x) => x + 1)}
                  >
                    Coba simpan lagi
                  </button>
                )}
                {loaded && (
                  <button className="secondary" onClick={() => download(data)}>
                    Ekspor cadangan
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={() => window.location.reload()}
                >
                  Muat ulang
                </button>
              </div>
            </div>
          )}
          {!loaded ? (
            <p>Catatan belum dimuat. Muat ulang untuk mencoba kembali.</p>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {tab === "Beranda"
                      ? "LET’S SHOW UP"
                      : tab === "Latihan"
                        ? "MAKE EVERY REP COUNT"
                        : tab === "Progress"
                          ? "SMALL STEPS. REAL PROGRESS."
                          : tab === 'Riwayat' ? 'EVERY SESSION COUNTS' : "YOUR PERSONAL SPACE"}
                  </div>
                  <h1>
                    {tab === "Beranda"
                      ? `Siap untuk set berikutnya${name === "Atlet" ? "" : `, ${name.split(" ")[0]}`}?`
                      : tab === "Latihan"
                        ? "Waktunya latihan."
                        : tab === "Progress"
                          ? "Lihat sejauh apa kamu melangkah."
                          : tab === 'Riwayat' ? 'Setiap sesi punya cerita.' : "Ruangmu, caramu."}
                  </h1>
                  <p>
                    {tab === "Beranda"
                      ? "Sedikit lebih kuat. Sedikit lebih konsisten. Setiap sesi berarti."
                      : tab === "Latihan"
                        ? "Pilih sesi, catat set, dan lanjutkan progressmu."
                        : tab === "Progress"
                          ? "Bandingkan gerakan yang sama dari sesi ke sesi."
                          : tab === 'Riwayat' ? 'Buka kembali, edit, dan kelola latihan yang sudah selesai.' : "Sesuaikan jadwal dan kelola catatan pribadimu."}
                  </p>
                </div>
                <span className="date-pill">
                  {now.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
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
                          {data.draft ? "LANJUTKAN SESIMU" : "SESI HARI INI"}
                        </span>
                        <span className="tag">{days[now.getDay()]}</span>
                      </div>
                      <h2>
                        {data.draft?.name ??
                          scheduled?.name ??
                          "Rest & recover"}
                      </h2>
                      <p>
                        {activeTemplate?.focus ??
                          "Beri ruang untuk istirahat. Sesi lain tetap bisa kamu pilih."}
                      </p>
                      <div className="session-meta">
                        <span>
                          <Dumbbell size={17} />
                          {data.draft?.exercises.length ??
                            scheduled?.exercises.length ??
                            0}{" "}
                          gerakan
                        </span>
                        <span>
                          <Target size={17} />
                          {data.draft
                            ? "Draf tersimpan"
                            : scheduled
                              ? "Sesuai jadwalmu"
                              : "Hari istirahat"}
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
                        {data.draft
                          ? "Lanjutkan latihan"
                          : scheduled
                            ? "Mulai latihan"
                            : "Pilih sesi latihan"}
                        <ArrowRight size={19} />
                      </button>
                      <div className="big-number" aria-hidden="true">
                        {data.draft
                          ? "GO"
                          : scheduled?.name === "Push"
                            ? "02"
                            : scheduled?.name === "Pull"
                              ? "01"
                              : scheduled?.name === "Legs"
                                ? "03"
                                : "↗"}
                      </div>
                    </section>
                    <section className="panel week-panel">
                      <div className="section-title">
                        <h2>Ritme minggu ini</h2>
                        <span className="muted">{week.length} sesi</span>
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
                              <span>{days[day].slice(0, 3)}</span>
                              <b
                                className={
                                  done ? "day-circle done" : "day-circle"
                                }
                              >
                                {done ? <Check size={17} /> : dayDate.getDate()}
                              </b>
                              <small>
                                {data.templates.some((t) => t.day === day)
                                  ? "Latihan"
                                  : "Rest"}
                              </small>
                            </div>
                          );
                        })}
                      </div>
                      <div className="week-footer">
                        <span className="legend-dot" /> Latihan selesai{" "}
                        <span className="muted">
                          Konsistensi dimulai dari hadir.
                        </span>
                      </div>
                    </section>
                  </div>
                  <section className="section-block">
                    <div className="section-title">
                      <h2>
                        Program latihanmu{" "}
                        <span className="count">{data.templates.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("Latihan")}
                      >
                        Lihat semua <ArrowUpRight size={16} />
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
                          <span className="program-day">{days[t.day]}</span>
                          <strong>{t.name}</strong>
                          <span className="muted">
                            {t.exercises.length} gerakan · {t.focus}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-title">
                      <h2>Latihan terakhir</h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("Progress")}
                      >
                        Riwayat lengkap <ArrowRight size={16} />
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
                              {dateLabel(w.date)} · {completedSets(w)} set
                              selesai
                            </small>
                          </div>
                          <b>
                            {fmt(volume(w))} <small>kg volume</small>
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
                          <strong>Halaman baru untuk progressmu.</strong>
                          <p>
                            Selesaikan sesi pertama untuk melihat riwayat di
                            sini.
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setTab("Latihan")}
                        >
                          Mulai sesi <ArrowRight size={16} />
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
                      setTab("Progress");
                    }}
                    onDiscard={() => {
                      if (confirm("Hapus draf latihan ini?"))
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
                              {days[t.day]} / 0{i + 1}
                            </span>
                            <h2>{t.name}</h2>
                            <p>{t.focus}</p>
                          </div>
                          <button className="primary" onClick={() => start(t)}>
                            Mulai <ArrowRight size={17} />
                          </button>
                        </div>
                        <div className="exercise-preview">
                          {t.exercises.map((e) => (
                            <div key={e.id}>
                              <span>{e.name}</span>
                              <small>
                                {e.minSets === e.maxSets
                                  ? e.minSets
                                  : `${e.minSets}–${e.maxSets}`}{" "}
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
                    if (confirm("Hapus sesi ini dari riwayat?"))
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
              {status}
            </span>
            <span>
              REPLOG <span className="muted">/ BUILT ONE REP AT A TIME</span>
            </span>
            <span>
              <ShieldCheck size={14} /> Catatan pribadi
            </span>
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
  return (
    <article className="stat">
      <div className="stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="stat-value">
        {value} <small>{unit}</small>
      </div>
      <p>{foot}</p>
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
            <span className="eyebrow">SESI AKTIF · {dateLabel(w.date)}</span>
            <h2>{w.name}</h2>
          </div>
          <span className="tag lime">
            {completedSets(w)} /{" "}
            {w.exercises.reduce((a, e) => a + e.sets.length, 0)} set
          </span>
        </div>
        {message && (
          <p role="alert" className="error">
            {message}
          </p>
        )}
        <RestTimer timer={timer} />
        <div className="previous-session panel"><Activity size={20}/><div><strong>{previous ? `Acuan ${previous.name} terakhir · ${new Date(previous.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : `Sesi ${w.name} pertamamu`}</strong><p>{previous ? 'Beban dan repetisi set yang selesai ditampilkan di setiap gerakan. Gunakan sebagai acuan, lalu isi hasil latihan hari ini.' : 'Belum ada sesi sebelumnya. Catatan hari ini akan menjadi acuan latihan berikutnya.'}</p></div></div>
        {w.exercises.map((item, ei) => {
          const e = item.exercise;
          const last = previous?.exercises.find(h => exerciseKey(h.exercise) === exerciseKey(e));
          return (
            <section className="panel exercise-card" key={ei}>
              <div className="exercise-head">
                <span className="exercise-number">
                  {String(ei + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{e.name}</h3>
                  <p>
                    {e.kind === "C" ? "Compound" : "Isolation"} · Target{" "}
                    {e.minSets}–{e.maxSets} set × {e.minReps}–{e.maxReps} rep
                  </p>
                </div>
              </div>
              {e.alternatives.length > 0 && (
                <label className="variant-label">
                  Variasi gerakan
                  <select
                    value={e.name}
                    onChange={(ev) => {
                      if (
                        item.sets.some((s) => s.done || s.kg || s.reps) &&
                        !confirm(
                          "Ganti variasi? Isian set gerakan ini akan dikosongkan.",
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
                <span>
                  Sesi sebelumnya:{" "}
                  {last
                    ? last.sets
                        .map((s, i) => s.done ? `Set ${i + 1}: ${s.kg} kg × ${s.reps} rep` : null)
                        .filter(Boolean)
                        .join(" · ") || "Belum ada set selesai"
                    : "Belum ada catatan"}
                </span>
              </div>
              <div className="set-header">
                <span>SET</span>
                <span>BEBAN (KG)</span>
                <span>REPETISI</span>
                <span>SELESAI</span>
                <span />
              </div>
              {item.sets.map((s, si) => (
                <div
                  className={s.done ? "set-row completed" : "set-row"}
                  key={si}
                >
                  <b>{si + 1}</b>
                  <input
                    aria-label={`${e.name} set ${si + 1} beban`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1500"
                    step="0.5"
                    placeholder="0"
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
                    aria-label={`${e.name} set ${si + 1} repetisi`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="1000"
                    placeholder={String(e.minReps)}
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
                    aria-label={`${e.name} set ${si + 1} selesai`}
                    aria-pressed={s.done}
                    onClick={() => setAt(ei, si, "done", !s.done)}
                  >
                    <Check size={19} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={item.sets.length <= 1}
                    aria-label={`Hapus ${e.name} set ${si + 1}`}
                    onClick={() => {
                      if (
                        (s.done || s.kg || s.reps) &&
                        !confirm("Hapus set beserta isinya?")
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
                <Plus size={16} /> Tambah set
              </button>
            </section>
          );
        })}
      </div>
      <aside className="workout-summary panel">
        <span className="eyebrow">RINGKASAN SESI</span>
        <h2>{w.name}</h2>
        <div className="summary-number">
          {completedSets(w)} <small>set selesai</small>
        </div>
        <div className="progress-track">
          <span
            style={{
              width: `${(completedSets(w) / w.exercises.reduce((a, e) => a + e.sets.length, 0)) * 100}%`,
            }}
          />
        </div>
        <div className="summary-line">
          <span>Volume latihan</span>
          <b>{fmt(volume(w))} kg</b>
        </div>
        <label>
          Catatan sesi
          <textarea
            maxLength={2000}
            placeholder="Bagaimana latihanmu hari ini?"
            value={w.notes}
            onChange={(ev) => onChange({ ...w, notes: ev.target.value })}
          />
        </label>
        <p className="hint">
          Tandai set yang selesai. Grafik hanya menghitung set yang ditandai.
        </p>
        <button className="primary" onClick={() => { if (completedSets(w)) timer.clear(); onFinish(); }}>
          <Check size={18} /> Selesaikan latihan
        </button>
        <button className="text-button danger" onClick={onDiscard}>
          <Trash2 size={15} /> Hapus draf
        </button>
        <p className="hint">
          Dumbbell: kg per tangan. Barbell: termasuk batang. Gunakan penamaan
          yang sama untuk mesin yang sama.
        </p>
      </aside>
    </div>
  );
}
function Progress({
  data,
  historyOnly = false,
  onEdit,
  onDelete,
}: {
  data: Data;
  historyOnly?: boolean;
  onEdit: (w: Workout) => void;
  onDelete: (id: string) => void;
}) {
  const programs = progressPrograms(data);
  const [selected, setSelected] = useState(programs[0]?.id ?? "");
  const programId = programs.some(p => p.id === selected) ? selected : programs[0]?.id ?? "";
  const charts = programProgress(data, programId);
  return (
    <>
      {!historyOnly && <section className="panel chart-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">PERKEMBANGAN BEBAN</span>
            <h2>Setiap kenaikan berarti.</h2>
          </div>
          <div>
            <label htmlFor="progress-program">Jenis latihan</label>
            <select id="progress-program" value={programId} onChange={e => setSelected(e.target.value)}>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <p className="muted">Beban tertinggi per sesi untuk setiap gerakan · maksimal 12 sesi terakhir dari jenis latihan yang dipilih.</p>
        <div className="program-charts">
          {charts.map(chart => (
            <article className="exercise-progress" key={chart.key}>
              <div className="section-title">
                <h3>{chart.name}</h3>
                <span className="tag">Rekor {chart.best === null ? "—" : fmt(chart.best)} kg</span>
              </div>
              {chart.points.length ? <Chart points={chart.points} name={chart.name} /> : (
                <div className="chart-empty">
                  <TrendingUp size={28} />
                  <p>Belum ada set selesai untuk {chart.name} pada jenis latihan ini.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>}
      {historyOnly && <section className="panel section-block">
        <div className="section-title">
          <h2>Riwayat latihan</h2>
          <span className="tag">{data.sessions.length} sesi</span>
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
                      {new Date(w.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · {completedSets(w)} set
                    </small>
                  </span>
                  <b>{fmt(volume(w))} kg</b>
                  <ChevronRight size={18} />
                </summary>
                <div className="history-body">
                  {w.exercises.map((e, i) => (
                    <p key={i}>
                      <b>{e.exercise.name}</b>
                      <span>
                        {e.sets
                          .filter((s) => s.done)
                          .map((s) => `${s.kg} kg × ${s.reps}`)
                          .join(" / ") || "Tidak diselesaikan"}
                      </span>
                    </p>
                  ))}
                  {w.notes && <p className="notes">{w.notes}</p>}
                  <div className="button-row">
                    <button className="secondary" onClick={() => onEdit(w)}>
                      Edit sesi
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => onDelete(w.id)}
                    >
                      Hapus sesi
                    </button>
                  </div>
                </div>
              </details>
            ))
        ) : (
          <div className="empty-inline">
            <Activity />
            <p>
              Belum ada sesi selesai. Catatan pertamamu akan muncul di sini.
            </p>
          </div>
        )}
      </section>}
    </>
  );
}
function Chart({ points, name }: { points: { date: string; kg: number }[]; name: string }) {
  const gradientId = useId();
  const max = Math.max(...points.map((p) => p.kg), 10) * 1.15;
  const x = (i: number) => 55 + (i * 600) / Math.max(points.length - 1, 1);
  const y = (kg: number) => 195 - (kg / max) * 160;
  return (
    <div className="chart">
      <svg
        viewBox="0 0 700 245"
        role="img"
        aria-label={`Grafik beban tertinggi per sesi ${name}`}
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
              {fmt((max * i) / 4)}
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
                {dateLabel(p.date)}: {p.kg} kg
              </title>
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
                {dateLabel(p.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <details className="chart-data">
        <summary>Lihat angka grafik</summary>
        {points.map((p, i) => (
          <p key={i}>
            {dateLabel(p.date)}: {fmt(p.kg)} kg
          </p>
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
      <div className="profile-grid">
        <section className="panel">
          <div className="profile-title">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <h2>{name}</h2>
              <p>{email}</p>
            </div>
          </div>
          <p className="privacy">
            <ShieldCheck size={17} />{" "}
            {demo
              ? "Pratinjau lokal, tidak terhubung ke akun."
              : "Catatan hanya dapat diakses akunmu."}
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => download(data)}>
              <ArrowDownToLine size={17} /> Ekspor data JSON
            </button>
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
                <LogOut size={17} /> Keluar
              </button>
            )}
          </div>
        </section>
        <section className="panel">
          <h2>
            Berat badan <span className="count">Opsional</span>
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
            <label>
              Tanggal
              <input
                type="date"
                required
                value={date}
                max={localDay()}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Berat (kg)
              <input
                type="number"
                required
                min="1"
                max="500"
                step="0.1"
                value={weight}
                placeholder="70"
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
            <button className="primary" aria-label="Simpan berat badan">
              <Plus size={19} />
            </button>
          </form>
          {[...data.weights]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((w) => (
              <div className="weight-row" key={w.id}>
                <span>{dateLabel(w.date + "T12:00:00")}</span>
                <b>{fmt(w.kg)} kg</b>
                <button
                  className="icon-button"
                  aria-label={`Hapus berat badan ${w.date}`}
                  onClick={() => {
                    if (confirm("Hapus catatan berat badan ini?"))
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
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="panel section-block">
        <div className="section-title">
          <div>
            <h2>Template & jadwal</h2>
            <p>Perubahan hanya berlaku untuk latihan baru milikmu.</p>
          </div>
          <Settings2 size={22} />
        </div>
        {data.templates.map((t) => (
          <div className="template-setting" key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <small>
                {days[t.day]} · {t.exercises.length} gerakan
              </small>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setEditing(structuredClone(t));
                setNotice("");
              }}
            >
              Sesuaikan
            </button>
          </div>
        ))}
      </section>
      {editing && (
        <dialog
          ref={editorRef}
          onCancel={() => setEditing(null)}
          aria-label="Edit template"
          className="template-editor panel"
        >
          <div className="section-title">
            <h2>Sesuaikan {editing.name}</h2>
            <button
              className="icon-button"
              aria-label="Tutup editor"
              onClick={() => setEditing(null)}
            >
              <X />
            </button>
          </div>
          <label>
            Nama sesi
            <input
              maxLength={100}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label>
            Hari latihan
            <select
              value={editing.day}
              onChange={(e) =>
                setEditing({ ...editing, day: Number(e.target.value) })
              }
            >
              {days.map((day, i) => (
                <option value={i} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <div className="hint">
            Target berupa rentang. Contoh: 2–3 set dan 10–12 repetisi. Gunakan
            nama berbeda untuk mesin atau variasi berbeda.
          </div>
          {editing.exercises.map((e, i) => (
            <div className="edit-exercise" key={e.id}>
              <div className="edit-name">
                <label>
                  Gerakan {i + 1}
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
                  aria-label={`Hapus gerakan ${e.name}`}
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
                      {["Set min", "Set maks", "Rep min", "Rep maks"][fi]}
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
            <Plus size={16} /> Tambah gerakan
          </button>
          {notice && (
            <p className="error" role="alert">
              {notice}
            </p>
          )}
          <div className="button-row editor-actions">
            <button className="primary" onClick={saveTemplate}>
              <Save size={17} /> Simpan template
            </button>
            <button className="secondary" onClick={() => setEditing(null)}>
              Batal
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
