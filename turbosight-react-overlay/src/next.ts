import type { NextConfig } from 'next';

export interface TurbosightOptions {
    /**
     * Path to the Turbosight SWC plugin WASM file.
     *
     * - When using the npm-published plugin: omit this field (defaults to
     *   `require.resolve('@thinkgrid/turbosight-swc-plugin')`).
     * - When working in the monorepo with a locally compiled WASM:
     *   pass the relative path to the `.wasm` file.
     *
     * @example '../turbosight-swc-plugin/target/wasm32-wasip1/release/turbosight_swc_plugin.wasm'
     */
    pluginPath?: string;

    /**
     * Options object forwarded to the SWC plugin.
     * Reserved for future plugin configuration. Default: `{}`.
     */
    pluginOptions?: Record<string, unknown>;
}

/**
 * Wraps your Next.js config to automatically wire up the Turbosight SWC plugin.
 *
 * Without this helper you need to manually add the SWC plugin entry to
 * `experimental.swcPlugins`. `withTurbosight` does that for you and merges
 * safely with any existing `swcPlugins` array in your config.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withTurbosight } from '@thinkgrid/turbosight/next';
 *
 * export default withTurbosight({
 *   // your existing Next.js config
 * });
 * ```
 *
 * @example Custom WASM path (monorepo / local development)
 * ```ts
 * export default withTurbosight(nextConfig, {
 *   pluginPath: '../turbosight-swc-plugin/target/wasm32-wasip1/release/turbosight_swc_plugin.wasm',
 * });
 * ```
 */
export function withTurbosight(
    nextConfig: NextConfig = {},
    options: TurbosightOptions = {}
): NextConfig {
    const {
        pluginPath = '@thinkgrid/turbosight-swc-plugin',
        pluginOptions = {},
    } = options;

    const existingSwcPlugins =
        (nextConfig.experimental as { swcPlugins?: [string, Record<string, unknown>][] })
            ?.swcPlugins ?? [];

    return {
        ...nextConfig,
        experimental: {
            ...nextConfig.experimental,
            swcPlugins: [
                ...existingSwcPlugins,
                [pluginPath, pluginOptions],
            ],
        },
    };
}
