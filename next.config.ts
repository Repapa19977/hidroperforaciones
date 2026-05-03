import type { NextConfig } from "next";
import path from "path";

const legacyAppUrl = process.env.LEGACY_APP_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    if (!legacyAppUrl) return [];

    return {
      beforeFiles: [
        {
          source: "/legacy",
          destination: `${legacyAppUrl}/`,
        },
        {
          source: "/legacy/:path*",
          destination: `${legacyAppUrl}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
