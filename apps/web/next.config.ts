import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const serviceWorkerHeaders = [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
    ];

    return [
      { source: "/sw.js", headers: serviceWorkerHeaders },
      { source: "/serwist/sw.js", headers: serviceWorkerHeaders },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@personal-finance/design-tokens"],
  async rewrites() {
    return [{ destination: "/serwist/sw.js", source: "/sw.js" }];
  },
};

export default withSerwist(nextConfig);
