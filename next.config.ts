import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // forbidden() w Panelu, gdy zalogowany użytkownik nie jest adminem (lib/auth.ts).
  experimental: { authInterrupts: true },
};

export default nextConfig;
