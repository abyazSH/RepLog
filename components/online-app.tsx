"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/client";
import Tracker from "@/components/tracker";
type Identity = { name: string; email: string };
export default function OnlineApp() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [message, setMessage] = useState("Memeriksa sesi login…");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = browserClient();
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) throw Error("Sesi login tidak ditemukan.");
        const permission = await client.rpc("replog_is_allowed");
        if (permission.error || permission.data !== true) throw Error("Akun belum diizinkan.");
        if (active) setIdentity({ name: data.user.user_metadata?.full_name || "Atlet", email: data.user.email || "" });
      } catch (error) {
        if (active) { setMessage(error instanceof Error ? error.message : "Sesi tidak dapat diperiksa."); window.setTimeout(() => window.location.assign("/login?error=access"), 1000); }
      }
    }
    load();
    return () => { active = false; };
  }, []);
  if (identity) return <Tracker demo={false} direct name={identity.name} email={identity.email} />;
  return <main className="login"><div className="login-card"><div className="brand">rep<span>log</span></div><h1>{message}</h1><p>Mohon tunggu…</p></div></main>;
}
