/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },

  /**
   * Proxy Firebase Auth handler requests through our own domain.
   *
   * Why this is necessary:
   * Chrome M115+ enforces storage partitioning / third-party cookie blocking.
   * Firebase's signInWithRedirect relies on a cross-origin iframe at
   * `<project>.firebaseapp.com` to hand back the credential after the OAuth
   * redirect completes. When the app is hosted on a different origin (Vercel),
   * that iframe is treated as a third-party context and its storage is blocked,
   * causing getRedirectResult() to return null and leaving the user stuck on
   * the login page.
   *
   * By proxying `/__/auth/*` through our own domain we make Firebase Auth run
   * in a first-party context, which is exactly what Firebase's official
   * guidance recommends for non-Firebase-Hosting deployments.
   *
   * Reference: https://firebase.google.com/docs/auth/web/redirect-best-practices
   */
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return [];
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;