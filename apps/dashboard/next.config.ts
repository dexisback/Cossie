import type { NextConfig } from "next";
import path from "path";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
  async rewrites() {
    // AGENT_URL lets Docker compose point at the `agent` service.
    // In local dev it defaults to localhost:4000.
    const agentUrl = process.env.AGENT_URL || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${agentUrl}/:path*`,
      },
    ];
  },
};

export default createMDX()(nextConfig);
