import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: [
    "*.run.app",
    "ais-dev-ls6ahdolepr43zqurht4y2-766919629100.asia-southeast1.run.app",
    "localhost:3000",
  ],
};

export default nextConfig;
