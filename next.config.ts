import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Next from selecting a parent folder with another lockfile.
    root: __dirname,
  },
};

export default nextConfig;
