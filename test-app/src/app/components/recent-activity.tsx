"use client";

import { useState } from "react";

export type ActivityItem = {
    id: number;
    user: string;
    action: string;
    target: string;
    time: string;
    type: "create" | "update" | "delete" | "view" | "comment";
};

const TYPE_CONFIG = {
    create: { color: "text-green-400", bg: "bg-green-900/30", icon: "+" },
    update: { color: "text-blue-400", bg: "bg-blue-900/30", icon: "~" },
    delete: { color: "text-red-400", bg: "bg-red-900/30", icon: "×" },
    view: { color: "text-zinc-400", bg: "bg-zinc-800", icon: "◉" },
    comment: { color: "text-yellow-400", bg: "bg-yellow-900/30", icon: "✦" },
};

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? items : items.slice(0, 3);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Last {items.length} events — minimal payload</span>
                <span className="text-green-400 font-mono">
                    ~{(JSON.stringify(items).length / 1024).toFixed(2)} KB in props
                </span>
            </div>
            <div className="flex flex-col gap-2">
                {visible.map((item) => {
                    const cfg = TYPE_CONFIG[item.type];
                    return (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${cfg.bg} ${cfg.color}`}>
                                {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-zinc-300">
                                    <span className="font-medium text-zinc-200">{item.user.split("@")[0]}</span>
                                    {" "}<span className={cfg.color}>{item.action}</span>{" "}
                                    <span className="text-zinc-400">{item.target}</span>
                                </div>
                                <div className="text-xs text-zinc-600 mt-0.5">{timeAgo(item.time)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {items.length > 3 && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    {expanded ? "Show less" : `Show ${items.length - 3} more`}
                </button>
            )}
        </div>
    );
}
