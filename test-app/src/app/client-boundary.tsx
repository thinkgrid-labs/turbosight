"use client";

import { useState } from "react";
import { useFlightStreamInterceptor } from "@thinkgrid/turbosight";

// The SWC plugin automatically wraps this export with __turbosight_wrap.
// Do NOT manually call __turbosight_wrap here — the plugin handles it.
export default function ClientBoundary({
    serverData,
}: {
    serverData: any;
}) {
    // Activate interceptor inside a client boundary
    useFlightStreamInterceptor();

    const [expanded, setExpanded] = useState(false);

    return (
        <div className="p-4 border-2 border-dashed border-zinc-700 m-4 rounded-xl">
            <h2 className="text-xl font-bold text-zinc-300">Client Component Zone</h2>
            <p className="text-sm text-zinc-500 mb-4">
                This component is marked with <code>use client</code>. The SWC plugin
                automatically detects this and wraps it in a TurbosightBoundary.
            </p>

            <button
                onClick={() => setExpanded(!expanded)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
                {expanded ? "Hide Data" : "Reveal Payload"}
            </button>

            {expanded && (
                <pre className="mt-4 p-4 bg-zinc-900 rounded-md overflow-auto text-xs text-zinc-400">
                    {JSON.stringify(serverData, null, 2)}
                </pre>
            )}
        </div>
    );
}
