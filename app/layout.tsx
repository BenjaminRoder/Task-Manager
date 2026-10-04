import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});
import { Navigation } from "@/components/navigation/navigation";
import "./globals.css";
import { AuthGate } from "@/components/auth/auth-gate";

export const metadata: Metadata = {
  title: { default: "Today · Task Manager", template: "%s · Task Manager" },
  description: "A focused space for your daily tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable}`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="app-shell">
          <Navigation />
          <main id="main-content" className="main-content" tabIndex={-1}>
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </body>
    </html>
  );
}
