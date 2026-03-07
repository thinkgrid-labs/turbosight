import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  experimental: {
    swcPlugins: [
      [
        "../turbosight-swc-plugin/target/wasm32-wasip1/release/turbosight_swc_plugin.wasm",
        {},
      ],
    ],
  },
};

export default nextConfig;
