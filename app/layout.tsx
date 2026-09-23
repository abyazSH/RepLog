import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RepLog — Catatan latihanmu",
  description:
    "Catat setiap set, lihat perkembangan, dan jalani latihanmu dengan lebih terarah.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
