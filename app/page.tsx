"use client";
import { useLanguage } from '@/components/language';
import Link from 'next/link';
import { ArrowUpRight, Check, Dumbbell, TrendingUp, CalendarDays, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Page() {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  return <div className="landing">
    <header className="landing-nav">
      <Link href="/" className="brand" aria-label={tr("RepLog")}><span className="brand-mark"><Dumbbell /></span>{tr("rep")}<span>{tr("log")}</span></Link>
      <nav aria-label={tr("Navigasi utama")}><a href="#fitur">{tr("Fitur")}</a><Link href="/login">{tr("Masuk")}</Link><Link className="primary" href="/register">{tr("Buat akun ")}<ArrowUpRight size={17}/></Link></nav>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">{tr("YOUR PACE. YOUR PROGRESS.")}</span>
          <h1>{tr("Setiap repetisi")}<br/>{tr("punya ")}<span>{tr("cerita.")}</span></h1>
          <p>{tr("Catat latihanmu hari ini. Lihat seberapa jauh kamu berkembang besok. RepLog membantu kamu menyimpan setiap set, mengikuti program, dan memahami progressmu.")}</p>
          <div className="landing-actions"><Link href="/register" className="primary">{tr("Mulai catat latihan ")}<ArrowUpRight size={19}/></Link><Link href="/demo" className="secondary">{tr("Coba demo ")}<ArrowRight size={18}/></Link></div>
          <div className="landing-promise"><ShieldCheck size={17}/>{tr(" Catatan pribadi. Fokus pada perkembanganmu sendiri.")}</div>
        </div>
        <div className="landing-preview" aria-label={tr("Contoh tampilan catatan latihan, bukan data akun")}>
          <div className="landing-preview-top"><span className="eyebrow">{tr("DI BALIK SETIAP PROGRESS")}</span><span className="tag">{tr("Contoh tampilan")}</span></div>
          <h2>{tr("One more rep.")}</h2><p className="muted">{tr("Push · Dada, bahu & triceps")}</p>
          <div className="landing-sample"><span>{tr("Chest Press")}</span><strong>30 <small>{tr("kg")}</small></strong></div>
          <div className="landing-set"><span>{tr("SET 01")}</span><b>{tr("30 kg × 12")}</b><Check size={19}/></div>
          <div className="landing-set"><span>{tr("SET 02")}</span><b>{tr("30 kg × 10")}</b><Check size={19}/></div>
          <div className="landing-set"><span>{tr("SET 03")}</span><b>{tr("30 kg × 10")}</b><Check size={19}/></div>
          <div className="landing-mini-chart"><div><TrendingUp size={21}/><b>{tr("Sedikit demi sedikit.")}</b></div><svg viewBox="0 0 420 90" role="img" aria-label={tr("Ilustrasi perkembangan beban")}><path d="M5 80H415M5 45H415M5 10H415" stroke="#30342b" fill="none"/><path d="M10 75L88 62L166 62L244 43L322 30L410 10" stroke="#c7f76b" strokeWidth="4" fill="none"/><circle cx="410" cy="10" r="5" fill="#c7f76b"/></svg><small>{tr("Usaha yang tercatat, perkembangan yang terlihat.")}</small></div>
        </div>
      </section>
      <section id="fitur" className="landing-features">
        <span className="eyebrow">{tr("DARI SET PERTAMA, SAMPAI REKOR BERIKUTNYA")}</span><h2>{tr("Ruang untuk rutinitasmu.")}</h2>
        <div className="landing-feature-grid">
          <article><Dumbbell/><h3>{tr("Catat setiap set")}</h3><p>{tr("Simpan beban dan repetisi, lanjutkan draf latihan, lalu buka kembali riwayatnya kapan pun.")}</p></article>
          <article><TrendingUp/><h3>{tr("Lihat perkembangan")}</h3><p>{tr("Pilih Push, Pull, Legs, atau program lainnya. Ikuti grafik beban setiap gerakan dari sesi ke sesi.")}</p></article>
          <article><CalendarDays/><h3>{tr("Program sesuai dirimu")}</h3><p>{tr("Mulai dengan jadwal latihan yang tersedia, lalu sesuaikan gerakan dan target dengan rutinitasmu.")}</p></article>
        </div>
      </section>
      <section className="landing-bottom"><div><span className="eyebrow">{tr("CONSISTENCY OVER PERFECTION")}</span><h2>{tr("Mulai dari latihan berikutnya.")}</h2><p>{tr("Tidak harus sempurna. Cukup mulai mencatat.")}</p></div><Link href="/register" className="primary">{tr("Buat akun RepLog ")}<ArrowUpRight size={19}/></Link></section>
    </main>
    <footer className="landing-footer"><span>{tr("RepLog · Catatan latihanmu.")}</span><Link href="/login">{tr("Sudah punya akun? Masuk →")}</Link></footer>
  </div>;
}
