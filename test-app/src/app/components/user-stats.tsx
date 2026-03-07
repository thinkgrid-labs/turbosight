"use client";

export type UserSummary = {
    total: number;
    activeToday: number;
    newThisMonth: number;
    byRole: Record<string, number>;
    byDepartment: Record<string, number>;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 flex flex-col gap-1">
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-sm text-zinc-400">{label}</div>
            {sub && <div className="text-xs text-zinc-500">{sub}</div>}
        </div>
    );
}

export default function UserStats({ stats }: { stats: UserSummary }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Aggregated server-side from {stats.total} records</span>
                <span className="text-green-400 font-mono">
                    ~{(JSON.stringify(stats).length / 1024).toFixed(2)} KB in props
                </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <StatCard label="Total Users" value={stats.total} />
                <StatCard label="Active Today" value={stats.activeToday} sub={`${((stats.activeToday / stats.total) * 100).toFixed(0)}% of total`} />
                <StatCard label="New This Month" value={stats.newThisMonth} sub={`${((stats.newThisMonth / stats.total) * 100).toFixed(0)}% growth`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wide">By Role</div>
                    <div className="flex flex-col gap-2">
                        {Object.entries(stats.byRole).map(([role, count]) => (
                            <div key={role} className="flex items-center justify-between text-sm">
                                <span className="text-zinc-300 capitalize">{role}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 bg-zinc-700 rounded-full h-1.5">
                                        <div
                                            className="bg-blue-500 h-1.5 rounded-full"
                                            style={{ width: `${(count / stats.total) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-zinc-400 w-6 text-right">{count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wide">By Department</div>
                    <div className="flex flex-col gap-2">
                        {Object.entries(stats.byDepartment).map(([dept, count]) => (
                            <div key={dept} className="flex items-center justify-between text-sm">
                                <span className="text-zinc-300">{dept}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 bg-zinc-700 rounded-full h-1.5">
                                        <div
                                            className="bg-green-500 h-1.5 rounded-full"
                                            style={{ width: `${(count / stats.total) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-zinc-400 w-6 text-right">{count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
