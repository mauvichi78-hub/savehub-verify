import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next/Turbopack stops walking up to ~/ and
  // picking the orphan ~/package-lock.json as the root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
