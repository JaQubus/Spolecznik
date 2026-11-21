import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // forbidden() w Panelu, gdy zalogowany użytkownik nie jest adminem (lib/auth.ts).
  experimental: { authInterrupts: true },
  // Publiczna baza nazywa się „Innowacje” (8/10); stare linki do /inicjatywy dalej działają.
  async redirects() {
    return [
      { source: "/inicjatywy", destination: "/innowacje", permanent: true },
      { source: "/inicjatywy/:slug", destination: "/innowacje/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
