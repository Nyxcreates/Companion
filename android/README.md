# Companion — Android Application

Native Android application for **Companion featuring Nikki**, tailored for Android 11–14 (including Oppo A96 / ColorOS).

---

## 1. Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Next.js Web / Backend (Vercel)    │
                      │   - MongoDB / Mongoose Data Layer    │
                      │   - Firebase Auth Token Verification │
                      │   - Gemini AI Companion Engine       │
                      └──────────────────▲───────────────────┘
                                         │ HTTPS / WSS
                                         │
                      ┌──────────────────▼───────────────────┐
                      │    Companion Android Application     │
                      │       (Package: Companion.company)   │
                      ├──────────────────────────────────────┤
                      │  MainActivity (Hardware WebView)     │
                      │  - Native splash & persistent session│
                      │  - Back-button navigation stack      │
                      │  - Offline network detection screen  │
                      ├──────────────────────────────────────┤
                      │  CompanionNativeBridge (JS Bridge)   │
                      │  - window.CompanionNative            │
                      ├──────────────────────────────────────┤
                      │  NikkiFloatingService (Foreground)   │
                      │  - Floating avatar & speech bubble   │
                      │  - SYSTEM_ALERT_WINDOW permission    │
                      ├──────────────────────────────────────┤
                      │  AppUsageTrackerService              │
                      │  - UsageStatsManager (Instagram etc.)│
                      │  - Local evaluation, zero data upload│
                      ├──────────────────────────────────────┤
                      │  CompanionMessagingService (FCM)     │
                      │  - Firebase Cloud Messaging receiver │
                      │  - 10 Companion notification channels│
                      └──────────────────────────────────────┘
```

---

## 2. Requirements & Setup

- **IDE:** Android Studio Iguana / Jellyfish / Koala (or newer)
- **JDK:** Java 17 (Temurin / OpenJDK 17)
- **Target Device:** Oppo A96 (or any device running Android 8.0+ / API 26+)
- **Firebase:** `android/app/google-services.json` is linked to Firebase project `companion-de741` with package `Companion.company`.

---

## 3. How to Build & Install on Your Phone (Oppo A96)

### Method A: Using Android Studio (Recommended)

1. Open **Android Studio**.
2. Select **Open** and choose the `android` folder (`c:\Users\Nishtha\OneDrive\Documents\Companion_App\android`).
3. Allow Gradle to sync dependencies.
4. Connect your **Oppo A96** via USB:
   - On phone: **Settings → About Device → Version → tap "Build number" 7 times** to unlock Developer Options.
   - Go to **Settings → Additional Settings → Developer Options → Enable USB Debugging**.
   - If prompted on Oppo A96: Allow USB debugging from this computer.
5. In Android Studio's device selector at the top, select your Oppo A96 (`CPH2333`).
6. Click the green **Run (▶)** button. The APK will build, install, and launch on your phone.

### Method B: Generating a Standalone Debug APK

In your terminal:

```powershell
cd c:\Users\Nishtha\OneDrive\Documents\Companion_App\android
.\gradlew assembleDebug
```

The APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

Copy this APK to your phone via USB or WhatsApp/Drive and tap to install!

---

## 4. Native Permissions & Features

| Feature | Android Permission | How User Enables It |
|---|---|---|
| **Floating Nikki Avatar** | `SYSTEM_ALERT_WINDOW` | Settings → Nikki Presence → toggle on → Oppo phone prompts "Display over other apps" → Allow |
| **Phone Usage Awareness** | `PACKAGE_USAGE_STATS` | Settings → Nikki Presence → toggle on → phone opens "Usage Access" settings → Allow Companion |
| **Push Notifications** | `POST_NOTIFICATIONS` | Prompted automatically on first launch (Android 13+) |

---

## 5. Production URL Configuration

The app points to your live Companion deployment. You can adjust this in:
`android/app/src/main/res/values/strings.xml`:

```xml
<string name="companion_web_url">https://your-production-url.vercel.app</string>
```

When running locally on Android Emulator, it automatically supports `http://10.0.2.2:3000`.

