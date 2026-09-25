import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened at 127.0.0.1 as well as localhost. Without this,
  // Next blocks the client scripts and the screener stays on its loading rows.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
