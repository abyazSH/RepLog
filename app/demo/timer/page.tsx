"use client";
import { useLanguage } from '@/components/language';
import Link from 'next/link';
import { RestTimer, useRestTimer } from '@/components/rest-timer';
export default function TimerDemo() {
  const { t: tr, locale, fmt, dateLabel, days } = useLanguage();

  const timer = useRestTimer('timer-preview');
  return <main className="timer-demo"><Link href="/demo">{tr("← Demo RepLog")}</Link><h1>{tr("Timer istirahat")}</h1><p>{tr("Coba mulai, jeda, lanjutkan, dan ubah sisa waktu. Pilih 30 detik untuk mencoba tampilan selesai lebih cepat.")}</p><RestTimer timer={timer}/></main>;
}
