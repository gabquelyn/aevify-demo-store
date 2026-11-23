import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output for the Docker image (Vercel ignores this).
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
