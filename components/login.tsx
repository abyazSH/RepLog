"use client";
import { useLanguage } from '@/components/language';
import { useEffect, useState } from 'react';
import { Dumbbell, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { browserClient } from '@/lib/supabase/client';
import Link from 'next/link';
const errors:Record<string,string>={
email_delivery:'Email konfirmasi belum bisa dikirim ke alamat ini. Pengelola perlu mengatur layanan pengiriman email. Untuk pengujian, gunakan email anggota proyek Supabase.',
email_limit:'Batas pengiriman email konfirmasi tercapai. Periksa inbox/spam dan tunggu sebelum mencoba lagi.',
rate_limit:'Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.',
weak_password:'Password belum memenuhi persyaratan keamanan. Gunakan password lebih kuat dengan huruf besar, huruf kecil, angka, dan simbol.',
invalid_email:'Alamat email tidak diterima. Gunakan alamat email asli yang bisa menerima pesan.',
signup_disabled:'Pendaftaran email belum diaktifkan oleh pengelola.',
captcha:'Verifikasi keamanan belum berhasil. Pengelola perlu memeriksa konfigurasi CAPTCHA.',
auth_server:'Layanan akun gagal memproses pendaftaran. Buka Supabase → Authentication → Logs untuk melihat penyebabnya.',
signin:'Email atau password salah, atau email belum dikonfirmasi.',register:'Supabase menolak pendaftaran tanpa memberi rincian. Umumnya karena email konfirmasi belum dapat dikirim. Buka Supabase → Authentication → Logs untuk melihat penyebabnya.',password:'Password minimal 8 karakter dan konfirmasinya harus sama.',input:'Lengkapi isian dengan benar.',access:'Akun belum bisa mengakses data. Pastikan email terkonfirmasi dan migrasi database terbaru sudah diterapkan.',network:'Koneksi bermasalah. Silakan coba lagi.'};
export default function Login({ready,register=false}:{ready:boolean;register?:boolean}){
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

 const [notice,setNotice]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{const q=new URLSearchParams(window.location.search);if(!register&&q.get('mode')==='register'){q.delete('mode');window.location.replace('/register'+(q.size?'?'+q.toString():''));return;}setPending(false);setMessage('');setNotice(errors[q.get('error')??'']??'');if(q.get('message')==='confirm')setMessage('Jika pendaftaran dapat diproses, tautan konfirmasi dikirim ke emailmu. Periksa inbox/spam lalu buka tautan di browser ini. Jika sudah punya akun, silakan masuk.');},[register]);
 const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  const form=new FormData(e.currentTarget);
  const email=String(form.get('email')??'').trim().toLowerCase();
  const password=String(form.get('password')??'');
  if(register&&password!==String(form.get('confirmPassword')??'')){setNotice(errors.password);return;}
  setPending(true);setNotice('');setMessage('');
  try {
   const auth=browserClient().auth;
   const result=register
    ?await auth.signUp({email,password,options:{data:{full_name:String(form.get('name')??'').trim()},emailRedirectTo:window.location.origin+'/auth/callback'}})
    :await auth.signInWithPassword({email,password});
   if(result.error){setNotice(errors[result.error.status===429?'rate_limit':register?'register':'signin']);setPending(false);return;}
   if(register&&!result.data.session){setMessage('Akun dibuat. Buka email konfirmasi, lalu masuk.');setPending(false);return;}
   setMessage(register?'Pendaftaran berhasil. Membuka dashboard…':'Login berhasil. Membuka dashboard…');
   window.location.assign('/dashboard');
  } catch {setNotice(errors.network);setPending(false);}
 };
 return <main className="login"><div className="login-card">
 <Link href="/" className="brand" aria-label={tr("Tentang RepLog")}><span className="brand-mark"><Dumbbell/></span>{tr("rep")}<span>{tr("log")}</span></Link>
 <div className="eyebrow">{tr("YOUR NEXT REP STARTS HERE")}</div>
 <h1>{tr(register?'Mulai perjalananmu.':'Latihan tercatat.')}<br/><span>{tr(register?'Buat akun RepLog.':'Progress terlihat.')}</span></h1>
 <p>{tr("Ruang pribadi untuk setiap set, setiap sesi, dan setiap langkah kecilmu.")}</p>
 <form className="auth-form" onSubmit={submit}>
 {register&&<label>{tr("Nama")}<input name="name" autoComplete="name" required maxLength={80}/></label>}
 <label>{tr("Email")}<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
 <label>{tr("Password")}<input name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={register?8:1} maxLength={128} required/></label>
 {register&&<label>{tr("Konfirmasi password")}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/><small>{tr("Gunakan minimal 8 karakter.")}</small></label>}
 <button className="primary" disabled={!ready||pending} type="submit">{tr(pending?'Memproses…':register?'Daftar akun':'Masuk')} <ArrowUpRight size={19}/></button>
 </form>
 {!pending && <Link className="text-button" href={register?'/login':'/register'}>{tr(register?'Sudah punya akun? Masuk':'Belum punya akun? Daftar')}</Link>}
 {!ready&&<p className="notice">{tr("Login online belum diaktifkan. Kamu bisa mencoba pratinjau.")}</p>}
 {tr(notice&&<p role="alert" className="error">{tr(notice)}</p>)}{tr(message&&<p role="status" className="notice">{tr(message)}</p>)}
 <a href="/demo" className="text-link">{tr("Coba pratinjau lokal →")}</a>
 <div className="privacy"><ShieldCheck size={16}/>{tr(" Catatanmu hanya dapat diakses oleh akunmu")}</div>
 </div><div className="login-art" aria-hidden="true"><b>{tr("ONE")}<br/>{tr("MORE")}<br/><span>{tr("REP.")}</span></b><small>{tr("CONSISTENCY OVER PERFECTION / REPLOG")}</small></div></main>;
}
