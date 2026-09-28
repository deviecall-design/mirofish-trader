import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened at 127.0.0.1 as well as localhost. Without this,
  // Next blocks the client scripts and the screener stays on its loading rows.
  allowedDevOrigins: ["127.0.0.1"],
  // The swarm route spawns `python -m mirofish.forecast_cli`. The interpreter
  // path is not a project file, so the file trace no longer pulls the whole
  // repo in — include the package the CLI imports.
  outputFileTracingIncludes: {
    "/api/cron/swarm": ["./mirofish/**/*"],
  },
};

export default nextConfig;
