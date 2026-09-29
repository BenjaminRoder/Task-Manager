import type { Metadata } from "next";
import { Navigation } from "@/components/navigation/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Today · Task Manager", template: "%s · Task Manager" },
  description: "A focused space for your daily tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="app-shell">
          <Navigation />
          <main id="main-content" className="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
