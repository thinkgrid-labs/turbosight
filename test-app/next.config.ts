import type { NextConfig } from "next";
import path from "path";
import { withTurbosight } from "@think-grid-labs/turbosight/next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
};

export default withTurbosight(nextConfig, {
  pluginPath: "../turbosight-swc-plugin/target/wasm32-wasip1/release/turbosight_swc_plugin.wasm",
});
