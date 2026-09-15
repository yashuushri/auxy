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
};

export default nextConfig;
