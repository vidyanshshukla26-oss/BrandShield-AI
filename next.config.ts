import type { NextConfig } from "next";

const renderApiUrl = process.env.RENDER_API_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  async rewrites() {
    if (!renderApiUrl) return [];
    return {
      beforeFiles: [{ source: "/api/:path*", destination: `${renderApiUrl}/api/:path*` }],
    };
  },
};

export default nextConfig;