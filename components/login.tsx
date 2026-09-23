"use client";
import { useEffect, useState } from 'react';
import { Dumbbell, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { browserClient } from '@/lib/supabase/client';
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
export default function Login({ready}:{ready:boolean}){
 const [register,setRegister]=useState(false),[notice,setNotice]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{const q=new URLSearchParams(window.location.search);setRegister(q.get('mode')==='register');setNotice(errors[q.get('error')??'']??'');if(q.get('message')==='confirm')setMessage('Jika pendaftaran dapat diproses, tautan konfirmasi dikirim ke emailmu. Periksa inbox/spam lalu buka tautan di browser ini. Jika sudah punya akun, silakan masuk.');if(q.has('error')||q.has('message'))window.history.replaceState(null,'',q.get('mode')==='register'?'/login?mode=register':'/login');},[]);
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
   window.setTimeout(()=>window.location.assign('/'),450);
  } catch {setNotice(errors.network);setPending(false);}
 };
 return <main className="login"><div className="login-card">
 <div className="brand"><span className="brand-mark"><Dumbbell/></span>rep<span>log</span></div>
 <div className="eyebrow">YOUR NEXT REP STARTS HERE</div>
 <h1>{register?'Mulai perjalananmu.':'Latihan tercatat.'}<br/><span>{register?'Buat akun RepLog.':'Progress terlihat.'}</span></h1>
 <p>Ruang pribadi untuk setiap set, setiap sesi, dan setiap langkah kecilmu.</p>
 <form className="auth-form" onSubmit={submit}>
 {register&&<label>Nama<input name="name" autoComplete="name" required maxLength={80}/></label>}
 <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
 <label>Password<input name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={register?8:1} maxLength={128} required/></label>
 {register&&<label>Konfirmasi password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/><small>Gunakan minimal 8 karakter.</small></label>}
 <button className="primary" disabled={!ready||pending} type="submit">{pending?'Memproses…':register?'Daftar akun':'Masuk'} <ArrowUpRight size={19}/></button>
 </form>
 <button className="text-button" disabled={pending} onClick={()=>{setRegister(!register);setNotice('');setMessage('');}}>{register?'Sudah punya akun? Masuk':'Belum punya akun? Daftar'}</button>
 {!ready&&<p className="notice">Login online belum diaktifkan. Kamu bisa mencoba pratinjau.</p>}
 {notice&&<p role="alert" className="error">{notice}</p>}{message&&<p role="status" className="notice">{message}</p>}
 <a href="/demo" className="text-link">Coba pratinjau lokal →</a>
 <div className="privacy"><ShieldCheck size={16}/> Catatanmu hanya dapat diakses oleh akunmu</div>
 </div><div className="login-art" aria-hidden="true"><b>ONE<br/>MORE<br/><span>REP.</span></b><small>CONSISTENCY OVER PERFECTION / REPLOG</small></div></main>;
}
