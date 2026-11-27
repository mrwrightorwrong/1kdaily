import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Track M is authored in TypeScript inside the workspace and must never
  // leak framework code into the money layer.
  transpilePackages: ["@1kdaily/core"],
  poweredByHeader: false,
  images: {
    // The brand lockup and proof-of-payment previews are served as AVIF/WebP
    // where the browser supports it.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
