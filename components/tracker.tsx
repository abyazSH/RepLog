"use client";
import { ThemePicker } from '@/components/theme';
import CardioEntry from '@/components/cardio-entry';
import {dashboardStats} from '@/lib/dashboard';
import {cardioProgress,cardioSummary,fieldsFor} from '@/lib/cardio';
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
  completedEntries, totalEntries, cardioMinutes, isCardio,
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
  direct = false,
  name,
  email,
}: {
  direct?: boolean;
  name: string;
  email: string;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const [sharing,setSharing] = useState<{workout:Workout;sample?:boolean}|null>(null);
  const [data, setData] = useState<Data>(emptyData);
  const [displayName, setDisplayName] = useState(name);
  const pathname = usePathname();
  const router = useRouter();
  const tab = tabForPath(pathname);
  function setTab(next: Tab) {
    router.push(tabRoutes[next]);
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
        if (direct) {
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
            "Semua perubahan tersimpan",
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
  }, [direct]);
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
          if (direct) {
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
              "Semua perubahan tersimpan",
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
  }, [data, loaded, direct, retry]);
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
  const overview = dashboardStats(data, now);
  const monday = overview.weekStart;
  const week = overview.week;
  const en = locale === "en-US";
  const signed = (value: number) => (value > 0 ? "+" : "") + fmt(value);
  const noComparison = en ? "No previous data yet" : "Belum ada data pembanding";
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
          href="/dashboard"
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
              href={tabRoutes[label]}
              aria-current={tab === label ? 'page' : undefined}
              className={tab === label ? "nav-item active" : "nav-item"}
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
          <div className="avatar">{tr(displayName.slice(0, 1).toUpperCase())}</div>
          <div>
            <strong>{tr(displayName.split(" ")[0])}</strong>
            <small>{tr("Akun pribadi")}</small>
          </div>
          <ShieldCheck size={18} />
        </div>
      </aside>
      <div className="main-shell">
        <main className="content">
          {loaded && !data.sessions.length && !data.draft && tab === "Beranda" && <section className="panel onboarding-guide"><h2>{locale === "en-US" ? "Welcome to RepLog" : "Selamat datang di RepLog"}</h2><p>{locale === "en-US" ? "Choose a program, record your sets, and review your progress. Customize your schedule and exercises in Profile." : "Pilih program, catat setiap set, lalu lihat perkembanganmu. Atur jadwal dan gerakan sesuai kebutuhanmu di Profil."}</p><button className="secondary" onClick={()=>setTab("Profil")}>{locale === "en-US" ? "Set up my programs" : "Atur program saya"}<ArrowRight size={17}/></button></section>}
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
                      ? `Siap untuk set berikutnya${displayName === "Atlet" ? "" : `, ${displayName.split(" ")[0]}`}?`
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
                  <div className="dashboard-week-context"><span className="tag">{en ? "Week in progress" : "Minggu berjalan"}</span><p>{en ? "Changes compare the same weekday and time last week." : "Perubahan dibandingkan hingga hari dan jam yang sama pada minggu lalu."}</p></div>
                  <section className="stats-grid" aria-label={en ? "Weekly training overview" : "Ringkasan latihan mingguan"}>
                    <Stat icon={<Activity/>} label={en ? "Sessions this week" : "Sesi minggu ini"} value={fmt(overview.sessions)} unit={overview.weeklyGoal ? "/ " + overview.weeklyGoal : undefined}
                      detail={overview.goalPercent === null ? (en ? "Set a weekly goal in Profile" : "Atur target mingguan di Profil") : overview.goalPercent + "% " + (en ? "of weekly goal" : "dari target mingguan")}
                      foot={overview.weeklyGoal ? (en ? overview.sessions + " of " + overview.weeklyGoal + " weekly sessions completed" : overview.sessions + " dari " + overview.weeklyGoal + " sesi mingguan selesai") : (en ? "No workout programs scheduled" : "Belum ada program terjadwal")}
                      help={en ? "The weekly goal is the number of programs in your current schedule." : "Target mingguan mengikuti jumlah program dalam jadwalmu saat ini."}/>
                    <Stat icon={<Layers/>} label={en ? "Sets this week" : "Set minggu ini"} value={fmt(overview.sets)}
                      detail={overview.setsDelta === null ? noComparison : signed(overview.setsDelta) + (en ? " sets" : " set")}
                      foot={en ? "vs the same period last week" : "vs periode setara minggu lalu"}
                      trend={overview.setsDelta === null ? undefined : overview.setsDelta>0 ? "up" : overview.setsDelta<0 ? "down" : "neutral"}/>
                    <Stat icon={<Dumbbell/>} label={en ? "Volume this week" : "Volume minggu ini"} value={fmt(overview.volumeKg)} unit="kg"
                      detail={overview.volumePercent !== null ? signed(overview.volumePercent) + "%" : overview.volumeDelta !== null ? signed(overview.volumeDelta) + " kg" : noComparison}
                      foot={en ? "vs the same period last week" : "vs periode setara minggu lalu"}
                      trend={overview.volumeDelta === null ? undefined : overview.volumeDelta>0 ? "up" : overview.volumeDelta<0 ? "down" : "neutral"}
                      help={en ? "Completed strength sets only: weight × reps. Cardio is excluded." : "Hanya set beban selesai: beban × repetisi. Kardio dihitung terpisah."}/>
                    <Stat icon={<TrendingUp/>} label={en ? "Exercise progress" : "Progres gerakan"} value={overview.comparedExercises ? fmt(overview.improvedExercises) : "—"} unit={overview.comparedExercises ? (en ? "improved" : "meningkat") : undefined}
                      detail={overview.comparedExercises ? (en ? "From " + overview.comparedExercises + " comparable exercises" : "Dari " + overview.comparedExercises + " gerakan dengan pembanding") : noComparison}
                      foot={en ? "Latest sessions this week vs previous sessions" : "Sesi terbaru minggu ini vs sesi sebelumnya"}
                      help={en ? "Compares the heaviest completed set (most reps if tied) in the same program and exercise variant. Higher load with at least equal reps, or more reps at equal load. Each exercise counts once; cardio is excluded." : "Membandingkan set selesai dengan beban tertinggi (repetisi terbanyak jika beban sama), pada program dan variasi gerakan yang sama. Naik beban dengan repetisi minimal sama, atau naik repetisi pada beban sama. Setiap gerakan dihitung sekali; kardio tidak termasuk."}/>
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
                                <span className="day-kind" role="img" aria-label={tr(data.templates.some(t=>t.day===day)?"Latihan":"Rest")} title={tr(data.templates.some(t=>t.day===day)?"Latihan":"Rest")}>{data.templates.some(t=>t.day===day)?<Dumbbell size={14}/>:"–"}</span>
                              </small>
                            </div>
                          );
                        })}
                      </div>
                      <div className="week-footer">
                        <span className="legend-dot" />{tr(" Latihan selesai")}{tr(" ")}
                        <span className="week-plan-legend"><Dumbbell size={14}/>{tr("Latihan")} <span>– {tr("Rest")}</span></span>
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
                      {!data.templates.length && <div className="panel"><p>{locale === "en-US" ? "Add a program in Profile to start training." : "Tambahkan program di Profil untuk mulai latihan."}</p><button className="secondary" onClick={()=>setTab("Profil")}>{tr("Profil")}</button></div>}
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
                              {tr(dateLabel(w.date))} · {completedSets(w)}{tr(" set selesai ")}{cardioMinutes(w)>0 && ` · ${fmt(cardioMinutes(w))} min`}</small>
                          </div>
                          <b>
                            {completedSets(w) ? <>{fmt(volume(w))} <small>{tr("kg volume")}</small></> : <>{fmt(cardioMinutes(w))} <small>min</small></>}
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
                      if (!completedEntries(w)) {
                        setError(
                          locale === "en-US" ? "Complete at least one set or cardio entry before saving." : "Tandai minimal satu set atau kardio selesai sebelum menyimpan sesi.",
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
                    {!data.templates.length && <section className="panel"><h2>{locale === "en-US" ? "Build your workout program" : "Buat program latihanmu"}</h2><p className="muted">{locale === "en-US" ? "Add your training days and exercises in Profile." : "Tambahkan hari latihan dan gerakan melalui Profil."}</p><button className="secondary" onClick={()=>setTab("Profil")}>{tr("Profil")}<ArrowRight size={17}/></button></section>}
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
                                {isCardio(e) ? `${e.targetMinutes ?? "—"} min` : <>{tr(e.minSets === e.maxSets
                                  ? e.minSets
                                  : `${e.minSets}–${e.maxSets}`)}{tr(" ")}
                                × {e.minReps}–{e.maxReps}</> }
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
                  name={displayName}
                  onNameChange={setDisplayName}
                  email={email}
                />
              )}
            </>
          )}
          {status === "Menyimpan…" && <p className="muted" role="status">{tr(status)}</p>}
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
  detail, trend, help,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  foot: string;
  detail?: string;
  trend?: "up" | "down" | "neutral";
  help?: string;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  return (
    <article className="stat" title={help}>
      <div className="stat-label">
        {tr(label)}
        <span>{tr(icon)}</span>
      </div>
      <div className="stat-value">
        {tr(value)} <small>{tr(unit)}</small>
      </div>
      {detail && <div className={"stat-comparison " + (trend ? "is-" + trend : "")}>{trend === "up" && <ArrowUpRight size={14} aria-hidden="true"/>}{tr(detail)}</div>}
      <p className="stat-foot">{tr(foot)}</p>
      {help && <details className="stat-help"><summary>{locale === "en-US" ? "How it’s calculated" : "Cara menghitung"}</summary><p>{help}</p></details>}
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
            {completedEntries(w)} / {totalEntries(w)} {locale === "en-US" ? "completed" : "selesai"}</span>
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
          if (isCardio(e)) return <CardioEntry key={e.id} entry={item} previous={last} onChange={entry=>{const next=structuredClone(w);next.exercises[ei]=entry;onChange(next);}}/>;
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
          {completedEntries(w)} <small>{locale === "en-US" ? "completed entries" : "bagian selesai"}</small>
        </div>
        <div className="progress-track">
          <span
            style={{
              width: `${(completedEntries(w) / totalEntries(w)) * 100}%`,
            }}
          />
        </div>
        <div className="summary-line">
          <span>{tr("Volume latihan")}</span>
          <b>{completedSets(w) ? `${fmt(volume(w))} kg` : `${fmt(cardioMinutes(w))} min`}</b>
        </div>
        {w.exercises.some(e=>isCardio(e.exercise)) && <div className="summary-line"><span>{locale === "en-US" ? "Cardio duration" : "Durasi kardio"}</span><b>{fmt(cardioMinutes(w))} min</b></div>}
        <label>{tr(" Catatan sesi ")}<textarea
            maxLength={2000}
            placeholder={tr("Bagaimana latihanmu hari ini?")}
            value={w.notes}
            onChange={(ev) => onChange({ ...w, notes: ev.target.value })}
          />
        </label>
        <p className="hint">{locale === "en-US" ? "Mark completed sets and cardio entries. Only completed entries appear in progress." : "Tandai set dan kardio yang selesai. Grafik hanya menghitung catatan yang ditandai."}</p>
        <button className="primary" onClick={() => { if (completedEntries(w)) timer.clear(); onFinish(); }}>
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
  const cardioCharts = cardioProgress(data, programId);
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
            <select id="progress-program" disabled={!programs.length} value={programId} onChange={e => setSelected(e.target.value)}>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <p className="muted">{locale === "en-US" ? "Strength: highest load per session. Cardio: select a metric. Up to 12 recent sessions for this program." : "Latihan beban: beban tertinggi per sesi. Kardio: pilih metrik yang ingin dilihat. Maksimal 12 sesi terakhir untuk program ini."}</p>
        {!programs.length && <p className="empty">{locale === "en-US" ? "Add a program and complete your first session to see your progress." : "Tambahkan program dan selesaikan sesi pertama untuk melihat perkembanganmu."}</p>}
        <div className="program-charts">
          {cardioCharts.map(chart=><CardioGraph key={chart.key} chart={chart}/>)}
          {charts.map(chart => (
            <article className="exercise-progress" key={chart.key}>
              <div className="section-title">
                <h3>{chart.name}</h3>
                <span className="tag">{tr("Rekor ")}{tr(chart.best === null ? "—" : fmt(chart.best))}{tr(" kg")}</span>
              </div>
              {chart.points.length ? <Chart points={chart.points.map(p=>({date:p.date,value:p.kg}))} name={chart.name} unit="kg" /> : (
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
                      · {completedSets(w)}{tr(" set ")}{cardioMinutes(w)>0 && ` · ${fmt(cardioMinutes(w))} min ${locale === "en-US" ? "cardio" : "kardio"}`}</small>
                  </span>
                  <b>{tr(fmt(volume(w)))}{tr(" kg")}</b>
                  <ChevronRight size={18} />
                </summary>
                <div className="history-body">
                  {w.exercises.map((e, i) => (
                    <p key={i}>
                      <b>{e.exercise.name}</b>
                      <span>
                        {isCardio(e.exercise) ? cardioSummary(e,locale) : tr(e.sets
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
function CardioGraph({chart}:{chart:ReturnType<typeof cardioProgress>[number]}) {
 const {language,fmt}=useLanguage();const en=language==="en";const [metric,setMetric]=useState("durationMinutes");
 const fields=fieldsFor(chart.tracking);const field=fields.find(f=>f.key===metric)??fields[0];
 const points=chart.points.filter(p=>p.cardio[field.key]!=="").map(p=>({date:p.date,value:Number(p.cardio[field.key])}));
 return <article className="exercise-progress"><div className="section-title"><h3>{chart.name}</h3><span className="tag">{en?"Cardio":"Kardio"}</span></div><label>{en?"Metric":"Metrik"}<select value={field.key} onChange={event=>setMetric(event.target.value)}>{fields.map(f=><option key={f.key} value={f.key}>{en?f.en:f.id}</option>)}</select></label>{points.length?<><p className="muted">{en?"Latest":"Terakhir"}: {fmt(points[points.length-1].value)} {field.unit}</p><Chart points={points} name={chart.name} unit={field.unit}/></>:<div className="chart-empty"><Activity size={28}/><p>{en?"No completed records for this metric yet.":"Belum ada catatan selesai untuk metrik ini."}</p></div>}</article>;
}
function Chart({ points, name, unit }: { points: { date: string; value: number }[]; name: string; unit:string }) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const gradientId = useId();
  const max = Math.max(...points.map((p) => p.value), 10) * 1.15;
  const x = (i: number) => 50 + (i * 320) / Math.max(points.length - 1, 1);
  const y = (kg: number) => 195 - (kg / max) * 160;
  return (
    <div className="chart">
      <svg
        viewBox="0 0 420 245"
        role="img"
        aria-label={`${name} · ${unit}`}
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
              x1="50"
              x2="380"
              y1={195 - i * 40}
              y2={195 - i * 40}
              stroke="#30342c"
              strokeDasharray="4 5"
            />
            <text x="4" y={200 - i * 40} fill="#8c9488" fontSize="12">
              {new Intl.NumberFormat(locale,{maximumFractionDigits:1,notation:"compact"}).format((max*i)/4)}
            </text>
          </g>
        ))}
        <path
          d={`M ${x(0)} 195 ${points.map((p, i) => `L ${x(i)} ${y(p.value)}`).join(" ")} L ${x(points.length - 1)} 195 Z`}
          fill={`url(#${gradientId})`}
        />
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
          fill="none"
          stroke="#c7f76b"
          strokeWidth="3"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="5" fill="#c7f76b">
              <title>
                {tr(dateLabel(p.date))}: {p.value} {unit}</title>
            </circle>
            {(i === 0 || i === Math.floor((points.length - 1) / 2) || i === points.length - 1) && (
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
            {tr(dateLabel(p.date))}: {tr(fmt(p.value))}{tr(" kg ")}</p>
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
  onNameChange,
}: {
  data: Data;
  onChange: React.Dispatch<React.SetStateAction<Data>>;
  name: string;
  email: string;
  onNameChange: (name: string) => void;
}) {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const en = locale === "en-US";
  const text = (id: string, english: string) => en ? english : id;
  const [newName, setNewName] = useState(name);
  const [nameBusy, setNameBusy] = useState(false);
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
      templates: data.templates.some(t => t.id === editing.id)
        ? data.templates.map((t) => (t.id === editing.id ? editing : t))
        : [...data.templates, editing],
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

      <div className="profile-layout">
        <section className="panel account-card">
          <div className="profile-title"><span className="avatar profile-avatar" role="img" aria-label={text("Avatar profil", "Profile avatar")}><User size={38}/></span><div><span className="eyebrow">{text("PROFIL SAYA", "MY PROFILE")}</span><h2>{name}</h2><p className="profile-email">{email}</p></div></div>
          <form className="profile-name-form" onSubmit={async event => {
            event.preventDefault(); const value = newName.trim(); if (!value || nameBusy) return;
            setNameBusy(true); setNotice("");
            try { const result = await browserClient().auth.updateUser({data:{full_name:value}}); if(result.error) throw result.error; onNameChange(value); setNewName(value); setNotice(text("Nama profil diperbarui.","Profile name updated.")); }
            catch { setNotice(text("Nama belum berhasil disimpan. Coba lagi.","Could not save your name. Please retry.")); }
            finally { setNameBusy(false); }
          }}><label>{text("Nama", "Name")}<input required maxLength={80} value={newName} onChange={event=>setNewName(event.target.value)}/></label><button className="secondary" disabled={nameBusy || !newName.trim() || newName.trim()===name}>{nameBusy ? text("Menyimpan…","Saving…") : text("Simpan nama","Save name")}</button></form>
          <div className="profile-weight"><div className="section-title"><h3>{text("Berat badan","Body weight")}</h3><span className="tag">{data.weights.length ? fmt([...data.weights].sort((a,b)=>b.date.localeCompare(a.date))[0].kg)+" kg" : text("Belum dicatat","Not recorded")}</span></div>
          <form className="weight-form" onSubmit={event=>{event.preventDefault();onChange(d=>({...d,weights:[{id:crypto.randomUUID(),date,kg:Number(weight)},...d.weights]}));setWeight("");setNotice(text("Berat badan dicatat.","Body weight recorded."));}}>
            <label>{text("Tanggal","Date")}<input type="date" required value={date} max={localDay()} onChange={event=>setDate(event.target.value)}/></label>
            <label>{text("Berat (kg)","Weight (kg)")}<input type="number" required min="1" max="500" step="0.1" placeholder="70" value={weight} onChange={event=>setWeight(event.target.value)}/></label>
            <button className="primary" aria-label={text("Simpan berat badan","Save body weight")}><Plus size={19}/></button>
          </form>
          {!!data.weights.length && <details><summary>{text("Riwayat berat badan","Weight history")}</summary>{[...data.weights].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(w=><div className="weight-row" key={w.id}><span>{dateLabel(w.date+"T12:00:00")}</span><b>{fmt(w.kg)} kg</b><button className="icon-button" aria-label={text("Hapus catatan ","Delete record ")+w.date} onClick={()=>{if(confirm(text("Hapus catatan berat badan ini?","Delete this weight record?")))onChange(d=>({...d,weights:d.weights.filter(x=>x.id!==w.id)}));}}><Trash2 size={15}/></button></div>)}</details>}</div>
          <div className="button-row account-actions"><button className="secondary" onClick={()=>download(data)}><ArrowDownToLine size={17}/>{text("Ekspor data","Export data")}</button><button className="text-button" onClick={async()=>{const result=await browserClient().auth.signOut({scope:"local"});if(result.error){setNotice(text("Belum berhasil keluar. Coba lagi.","Could not sign out. Please retry."));return;}window.location.assign("/login");}}><LogOut size={17}/>{text("Keluar","Sign out")}</button></div>
        </section>
        <section className="panel settings-card"><span className="eyebrow">{text("PENGATURAN","SETTINGS")}</span><h2>{text("Sesuaikan tampilan","Make it yours")}</h2><div className="settings-language"><h3>{text("Bahasa","Language")}</h3><p className="muted">{text("Bahasa tampilan di seluruh RepLog.","Display language across RepLog.")}</p><LanguagePicker/></div><ThemePicker embedded/></section>
      </div>
      {notice && !editing && <p className="notice" role="status">{tr(notice)}</p>}
      <section className="panel section-block program-settings">
        <div className="section-title"><div><span className="eyebrow">{text("PROGRAM SAYA","MY PROGRAMS")}</span><h2>{text("Program & jadwal latihan","Workout programs & schedule")}</h2><p>{text("Atur hari, gerakan, set, dan repetisi sesuai kebutuhanmu.","Choose your training days, exercises, sets, and reps.")}</p></div><button className="primary" disabled={data.templates.length>=20} onClick={()=>{setNotice("");setEditing({id:crypto.randomUUID(),name:text("Latihan baru","New workout"),day:new Date().getDay(),focus:text("Latihan pribadi","Personal training"),exercises:[{id:crypto.randomUUID(),name:text("Gerakan baru","New exercise"),kind:"C",minSets:2,maxSets:3,minReps:10,maxReps:12,alternatives:[]}]});}}><Plus size={18}/>{text("Tambah program","Add program")}</button></div>
        {!data.sessions.length && <div className="hint">{text("Mulai dengan program bawaan, lalu tekan Sesuaikan untuk mengganti hari atau menambah gerakan. Kamu juga bisa menghapus program dan membuat jadwal sendiri.","Start with the default programs, then choose Customize to change days or add exercises. You can also remove the programs and build your own schedule.")}</div>}
        {!data.templates.length && <p className="empty">{text("Belum ada program. Tambahkan program pertama atau gunakan program bawaan.","No programs yet. Add your first program or use the default programs.")}</p>}
        {data.templates.map(t=><div className="template-setting" key={t.id}><div><strong>{t.name}</strong><small>{days[t.day]} · {t.exercises.length} {text("gerakan","exercises")}</small></div><div className="button-row"><button className="secondary" onClick={()=>{setEditing(structuredClone(t));setNotice("");}}>{text("Sesuaikan","Customize")}</button><button className="icon-button" aria-label={text("Hapus program ","Delete program ")+t.name} onClick={()=>{if(confirm(text("Hapus program ","Delete program ")+t.name+text("? Riwayat dan sesi aktif tetap tersimpan.","? History and your active session will be kept.")))onChange(d=>({...d,templates:d.templates.filter(x=>x.id!==t.id)}));}}><Trash2 size={17}/></button></div></div>)}
        <div className="button-row program-actions"><button className="secondary" onClick={()=>{if(confirm(text("Ganti jadwal dengan program bawaan? Riwayat dan sesi aktif tetap tersimpan.","Replace your schedule with the default programs? History and your active session will be kept.")))onChange(d=>({...d,templates:emptyData().templates}));}}>{text("Gunakan program bawaan","Use default programs")}</button><button className="text-button danger" disabled={!data.templates.length} onClick={()=>{if(confirm(text("Hapus seluruh program dan jadwal latihan? Riwayat serta sesi aktif tetap tersimpan. Kamu bisa membuat program baru setelahnya.","Delete all workout programs and schedules? History and your active session will be kept. You can create new programs afterwards.")))onChange(d=>({...d,templates:[]}));}}><Trash2 size={17}/>{text("Hapus semua program","Delete all programs")}</button></div>
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
          <label>{text("Fokus latihan", "Training focus")}<input maxLength={100} required value={editing.focus} onChange={event=>setEditing({...editing,focus:event.target.value})}/></label>
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
              <label>{text("Jenis pencatatan", "Tracking type")}<select value={e.tracking??"strength"} onChange={event=>{const tracking=event.target.value as "strength"|"treadmill"|"bike";setEditing({...editing,exercises:editing.exercises.map((x,j)=>j===i?{...x,tracking,targetMinutes:tracking==="strength"?undefined:x.targetMinutes??20,alternatives:tracking==="strength"?x.alternatives:[]}:x)});}}><option value="strength">{text("Latihan beban","Strength training")}</option><option value="treadmill">Treadmill</option><option value="bike">{text("Sepeda gym","Stationary bike")}</option></select></label>
              {isCardio(e) ? <label>{text("Target durasi (menit)","Target duration (minutes)")}<input type="number" min="1" max="600" step="any" value={e.targetMinutes??20} onChange={event=>setEditing({...editing,exercises:editing.exercises.map((x,j)=>j===i?{...x,targetMinutes:Number(event.target.value)}:x)})}/></label> : <>
              <label>{text("Jenis gerakan", "Exercise type")}<select value={e.kind} onChange={event=>setEditing({...editing,exercises:editing.exercises.map((x,j)=>j===i?{...x,kind:event.target.value as "C"|"I"}:x)})}><option value="C">Compound</option><option value="I">Isolation</option></select></label>
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
              </>}
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
                    name: text("Gerakan baru", "New exercise"),
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
          <div className="button-row">{(["treadmill","bike"] as const).map(type=><button type="button" key={type} className="secondary" disabled={editing.exercises.length>=30} onClick={()=>setEditing({...editing,exercises:[...editing.exercises,{id:crypto.randomUUID(),name:type==="treadmill"?"Treadmill":text("Sepeda gym","Stationary bike"),kind:"I",tracking:type,targetMinutes:20,minSets:1,maxSets:1,minReps:1,maxReps:1,alternatives:[]}]})}><Plus size={16}/>{type==="treadmill"?text("Tambah treadmill","Add treadmill"):text("Tambah sepeda gym","Add stationary bike")}</button>)}</div>
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
