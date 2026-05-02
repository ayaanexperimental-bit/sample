import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: "export" as const,
        images: {
          unoptimized: true
        }
      }
    : {})
};

export default nextConfig;
