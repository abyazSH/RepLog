import { themeBootstrap } from "@/lib/theme";
import { ThemeProvider } from "@/components/theme";
import { LanguageProvider } from "@/components/language";
import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./theme.css";
export const metadata: Metadata = {
  title: "RepLog — Catatan latihanmu",
  description:
    "Catat setiap set, lihat perkembangan, dan jalani latihanmu dengan lebih terarah.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }}/></head>
      <body><LanguageProvider><ThemeProvider>{children}</ThemeProvider></LanguageProvider></body>
    </html>
  );
}
