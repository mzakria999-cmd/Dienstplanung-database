import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/server/i18n";
import { I18nProvider } from "@/components/i18n-provider";
import { ToastProvider } from "@/components/ui/toast";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "SecurityDienst Manager Pro", template: "%s · SecurityDienst Manager Pro" },
  description: "Dienstplanung & Mitarbeiterverwaltung für Sicherheitsdienste",
  manifest: "/manifest.webmanifest",
  applicationName: "SecurityDienst Manager Pro",
  appleWebApp: { capable: true, title: "SD Manager", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0f1d36", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
