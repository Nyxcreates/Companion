import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { WorldThemeContextProvider } from "@/context/WorldThemeContext";
import { SoundtrackProvider } from "@/context/SoundtrackContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { UsageProvider } from "@/context/UsageContext";
import { PwaProvider } from "@/context/PwaContext";
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
  description: "A small, proactive AI presence for your everyday life.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Companion",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
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
                <SoundtrackProvider>
                  <NotificationProvider>
                    <UsageProvider>
                      <PwaProvider>
                        <MotionProvider>
                          {children}
                          <StartupSequence />
                        </MotionProvider>
                      </PwaProvider>
                    </UsageProvider>
                  </NotificationProvider>
                </SoundtrackProvider>
              </WorldThemeContextProvider>
            </ProfileProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
