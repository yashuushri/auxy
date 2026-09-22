import type { NextConfig } from "next";

const isStandalone = process.env.BUILD_STANDALONE === "true";

const nextConfig: NextConfig = {
  // Only use standalone when explicitly set (e.g. Docker/Cloud Run), Vercel manages its own serverless bundling
  ...(isStandalone ? { output: "standalone" } : {}),
  devIndicators: false,
  allowedDevOrigins: [
    "*.run.app",
    "ais-dev-ls6ahdolepr43zqurht4y2-766919629100.asia-southeast1.run.app",
    "localhost:3000",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.emojiterra.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/@:username",
        destination: "/u/:username",
      },
    ];
  },
};

export default nextConfig;
