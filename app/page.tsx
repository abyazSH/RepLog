import Link from 'next/link';
import { ArrowUpRight, Check, Dumbbell, TrendingUp, CalendarDays, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Page() {
  return <div className="landing">
    <header className="landing-nav">
      <Link href="/" className="brand" aria-label="RepLog"><span className="brand-mark"><Dumbbell /></span>rep<span>log</span></Link>
      <nav aria-label="Navigasi utama"><a href="#fitur">Fitur</a><Link href="/login">Masuk</Link><Link className="primary" href="/register">Buat akun <ArrowUpRight size={17}/></Link></nav>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">YOUR PACE. YOUR PROGRESS.</span>
          <h1>Setiap repetisi<br/>punya <span>cerita.</span></h1>
          <p>Catat latihanmu hari ini. Lihat seberapa jauh kamu berkembang besok. RepLog membantu kamu menyimpan setiap set, mengikuti program, dan memahami progressmu.</p>
          <div className="landing-actions"><Link href="/register" className="primary">Mulai catat latihan <ArrowUpRight size={19}/></Link><Link href="/demo" className="secondary">Coba demo <ArrowRight size={18}/></Link></div>
          <div className="landing-promise"><ShieldCheck size={17}/> Catatan pribadi. Fokus pada perkembanganmu sendiri.</div>
        </div>
        <div className="landing-preview" aria-label="Contoh tampilan catatan latihan, bukan data akun">
          <div className="landing-preview-top"><span className="eyebrow">DI BALIK SETIAP PROGRESS</span><span className="tag">Contoh tampilan</span></div>
          <h2>One more rep.</h2><p className="muted">Push · Dada, bahu & triceps</p>
          <div className="landing-sample"><span>Chest Press</span><strong>30 <small>kg</small></strong></div>
          <div className="landing-set"><span>SET 01</span><b>30 kg × 12</b><Check size={19}/></div>
          <div className="landing-set"><span>SET 02</span><b>30 kg × 10</b><Check size={19}/></div>
          <div className="landing-set"><span>SET 03</span><b>30 kg × 10</b><Check size={19}/></div>
          <div className="landing-mini-chart"><div><TrendingUp size={21}/><b>Sedikit demi sedikit.</b></div><svg viewBox="0 0 420 90" role="img" aria-label="Ilustrasi perkembangan beban"><path d="M5 80H415M5 45H415M5 10H415" stroke="#30342b" fill="none"/><path d="M10 75L88 62L166 62L244 43L322 30L410 10" stroke="#c7f76b" strokeWidth="4" fill="none"/><circle cx="410" cy="10" r="5" fill="#c7f76b"/></svg><small>Usaha yang tercatat, perkembangan yang terlihat.</small></div>
        </div>
      </section>
      <section id="fitur" className="landing-features">
        <span className="eyebrow">DARI SET PERTAMA, SAMPAI REKOR BERIKUTNYA</span><h2>Ruang untuk rutinitasmu.</h2>
        <div className="landing-feature-grid">
          <article><Dumbbell/><h3>Catat setiap set</h3><p>Simpan beban dan repetisi, lanjutkan draf latihan, lalu buka kembali riwayatnya kapan pun.</p></article>
          <article><TrendingUp/><h3>Lihat perkembangan</h3><p>Pilih Push, Pull, Legs, atau program lainnya. Ikuti grafik beban setiap gerakan dari sesi ke sesi.</p></article>
          <article><CalendarDays/><h3>Program sesuai dirimu</h3><p>Mulai dengan jadwal latihan yang tersedia, lalu sesuaikan gerakan dan target dengan rutinitasmu.</p></article>
        </div>
      </section>
      <section className="landing-bottom"><div><span className="eyebrow">CONSISTENCY OVER PERFECTION</span><h2>Mulai dari latihan berikutnya.</h2><p>Tidak harus sempurna. Cukup mulai mencatat.</p></div><Link href="/register" className="primary">Buat akun RepLog <ArrowUpRight size={19}/></Link></section>
    </main>
    <footer className="landing-footer"><span>RepLog · Catatan latihanmu.</span><Link href="/login">Sudah punya akun? Masuk →</Link></footer>
  </div>;
}
