import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The swarm route spawns `python -m mirofish.forecast_cli`. The interpreter
  // path is not a project file, so the file trace no longer pulls the whole
  // repo in — include the package the CLI imports.
  outputFileTracingIncludes: {
    "/api/cron/swarm": ["./mirofish/**/*"],
  },
};

export default nextConfig;
