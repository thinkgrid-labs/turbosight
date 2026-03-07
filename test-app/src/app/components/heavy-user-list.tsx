"use client";

import { useState } from "react";

export type User = {
    id: number;
    name: string;
    email: string;
    role: string;
    department: string;
    joinDate: string;
    lastLogin: string;
    permissions: string[];
    address: { street: string; city: string; country: string };
    preferences: { theme: string; notifications: boolean; language: string };
};

export default function HeavyUserList({ users }: { users: User[] }) {
    const [page, setPage] = useState(0);
    const pageSize = 8;
    const slice = users.slice(page * pageSize, page * pageSize + pageSize);
    const totalPages = Math.ceil(users.length / pageSize);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{users.length} users loaded into client memory</span>
                <span className="text-red-400 font-mono">
                    ~{(JSON.stringify(users).length / 1024).toFixed(1)} KB in props
                </span>
            </div>
            <div className="overflow-auto rounded-lg border border-zinc-700">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-zinc-700 bg-zinc-800">
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Name</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Role</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Department</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">City</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Permissions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {slice.map((user) => (
                            <tr key={user.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                <td className="px-3 py-2">
                                    <div className="font-medium text-zinc-200">{user.name}</div>
                                    <div className="text-zinc-500 text-xs">{user.email}</div>
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${user.role === "admin"
                                        ? "bg-purple-900/50 text-purple-300"
                                        : "bg-zinc-700 text-zinc-300"
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-zinc-400">{user.department}</td>
                                <td className="px-3 py-2 text-zinc-400">{user.address.city}</td>
                                <td className="px-3 py-2 text-zinc-500 text-xs">{user.permissions.join(", ")}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Page {page + 1} of {totalPages} (all {users.length} records in memory)</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >← Prev</button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page === totalPages - 1}
                        className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >Next →</button>
                </div>
            </div>
        </div>
    );
}
