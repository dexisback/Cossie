import type { NextConfig } from "next";
import path from "path";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
  // Disabled: the Turbopack persistent dev cache grows unbounded and can
  // trigger a write-invalidation loop at idle that leaks RAM until the host
  // OOMs (vercel/next.js#81161, #91396 on Next 16.2.x).
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  async rewrites() {
    // AGENT_URL lets Docker compose point at the `agent` service.
    // In local dev it defaults to localhost:4000.
    const agentUrl = process.env.AGENT_URL || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${agentUrl}/api/:path*`,
      },
    ];
  },
};

export default createMDX()(nextConfig);
