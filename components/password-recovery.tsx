"use client";
import { useEffect, useState } from 'react';
import { ArrowUpRight, Dumbbell, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/language';
import { browserClient } from '@/lib/supabase/client';
import { recoveryError, recoveryMessages, validNewPassword } from '@/lib/password-recovery';

export default function PasswordRecovery({ready, reset = false}: {ready: boolean; reset?: boolean}) {
  const {t} = useLanguage();
  const [notice, setNotice] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'expired') setNotice(recoveryMessages.expired);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending || complete || expired) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (reset && !validNewPassword(password, String(form.get('confirmPassword') ?? ''))) {
      setNotice(recoveryMessages.password);
      return;
    }
    setPending(true);
    setNotice('');
    setMessage('');
    try {
      const auth = browserClient().auth;
      if (reset) {
        const identity = await auth.getUser();
        if (identity.error || !identity.data.user) {
          setExpired(true);
          setNotice(recoveryMessages.expired);
          return;
        }
        const {error} = await auth.updateUser({password});
        if (error) {
          const text = recoveryError(error, true);
          setNotice(text);
          if (text === recoveryMessages.expired) setExpired(true);
          return;
        }
        setComplete(true);
        setMessage('Password berhasil diperbarui. Gunakan password baru saat masuk berikutnya.');
      } else {
        const email = String(form.get('email') ?? '').trim().toLowerCase();
        const {error} = await auth.resetPasswordForEmail(email, {redirectTo: window.location.origin + '/auth/recovery'});
        if (error) { setNotice(recoveryError(error)); return; }
        setMessage(recoveryMessages.sent);
      }
    } catch {
      setNotice(recoveryMessages.network);
    } finally {
      setPending(false);
    }
  }

  return <main className="login"><div className="login-card">
    <Link href="/" className="brand" aria-label={t('Tentang RepLog')}><span className="brand-mark"><Dumbbell/></span>{t('rep')}<span>{t('log')}</span></Link>
    <div className="eyebrow">{t('PEMULIHAN AKUN')}</div>
    <h1>{t(reset ? 'Buat password baru.' : 'Lupa kata sandi?')}</h1>
    <p>{t(reset ? 'Pilih password yang kuat untuk menjaga keamanan akunmu.' : 'Masukkan email akunmu untuk menerima tautan pemulihan password.')}</p>
    {!complete && !expired && <form className="auth-form" onSubmit={submit}>
      <fieldset disabled={!ready || pending} className="recovery-fields">
        {reset ? <>
          <label>{t('Password baru')}<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label>
          <label>{t('Konfirmasi password')}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/><small>{t('Gunakan minimal 8 karakter.')}</small></label>
        </> : <label>{t('Email')}<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
        <button className="primary" type="submit">{t(pending ? 'Memproses…' : reset ? 'Simpan password baru' : 'Kirim tautan pemulihan')} <ArrowUpRight size={19}/></button>
      </fieldset>
    </form>}
    {notice && <p role="alert" className="error">{t(notice)}</p>}
    {message && <p role="status" className="notice">{t(message)}</p>}
    {!ready && <p className="notice">{t('Pemulihan password belum diaktifkan. Hubungi pengelola.')}</p>}
    {complete ? <Link className="text-button" href="/dashboard">{t('Lanjut ke dashboard')}</Link> : <>
      {expired && <Link className="text-button" href="/forgot-password">{t('Minta tautan baru')}</Link>}
      <Link className="text-button" href="/login">{t('Kembali ke login')}</Link>
    </>}
    <div className="privacy"><ShieldCheck size={16}/>{t(' Catatanmu hanya dapat diakses oleh akunmu')}</div>
  </div><div className="login-art" aria-hidden="true"><b>{t('ONE')}<br/>{t('MORE')}<br/><span>{t('REP.')}</span></b><small>{t('CONSISTENCY OVER PERFECTION / REPLOG')}</small></div></main>;
}
