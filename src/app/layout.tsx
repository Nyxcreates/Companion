import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { WorldThemeContextProvider } from "@/context/WorldThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { UsageProvider } from "@/context/UsageContext";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { StartupSequence } from "@/components/startup/StartupSequence";
import "./globals.css";

const quicksand = localFont({
  src: "./fonts/Quicksand-Variable.woff2",
  variable: "--font-display",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Companion",
  description: "A small presence for your everyday life.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b1e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${quicksand.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ToastProvider>
            <ProfileProvider>
              <WorldThemeContextProvider>
                <NotificationProvider>
                  <UsageProvider>
                    <MotionProvider>
                      {children}
                      <StartupSequence />
                    </MotionProvider>
                  </UsageProvider>
                </NotificationProvider>
              </WorldThemeContextProvider>
            </ProfileProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
