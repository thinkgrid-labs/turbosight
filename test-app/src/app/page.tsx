import HeavyUserList, { type User } from "./components/heavy-user-list";
import UserStats, { type UserSummary } from "./components/user-stats";
import ProductGrid, { type Product } from "./components/product-grid";
import RecentActivity, { type ActivityItem } from "./components/recent-activity";

// ---------------------------------------------------------------------------
// Server-side data generation (simulates DB calls — runs on server only)
// ---------------------------------------------------------------------------

function generateUsers(count: number): User[] {
    const firstNames = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Hank", "Iris", "Jake"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore"];
    const departments = ["Engineering", "Design", "Marketing", "Sales", "Support"];
    const roles = ["admin", "editor", "viewer", "member", "guest"];
    const cities = ["New York", "London", "Tokyo", "Paris", "Sydney"];
    const countries = ["US", "UK", "JP", "FR", "AU"];

    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % 10]} ${lastNames[Math.floor(i / 10) % 10]}`,
        email: `${firstNames[i % 10].toLowerCase()}${i + 1}@company.example.com`,
        role: roles[i % roles.length],
        department: departments[i % departments.length],
        joinDate: new Date(2019 + (i % 5), i % 12, (i % 28) + 1).toISOString(),
        lastLogin: new Date(Date.now() - i * 86_400_000).toISOString(),
        permissions: (["read", "write", i % 3 === 0 ? "delete" : null, i % 7 === 0 ? "admin" : null] as (string | null)[])
            .filter((p): p is string => p !== null),
        address: {
            street: `${i + 1} Main Street`,
            city: cities[i % cities.length],
            country: countries[i % countries.length],
        },
        preferences: {
            theme: i % 2 === 0 ? "dark" : "light",
            notifications: i % 3 !== 0,
            language: ["en", "es", "fr", "de", "ja"][i % 5],
        },
    }));
}

function computeStats(users: User[]): UserSummary {
    return {
        total: users.length,
        activeToday: Math.round(users.length * 0.15),
        newThisMonth: Math.round(users.length * 0.08),
        byRole: users.reduce<Record<string, number>>((acc, u) => {
            acc[u.role] = (acc[u.role] ?? 0) + 1;
            return acc;
        }, {}),
        byDepartment: users.reduce<Record<string, number>>((acc, u) => {
            acc[u.department] = (acc[u.department] ?? 0) + 1;
            return acc;
        }, {}),
    };
}

function generateProducts(count: number): Product[] {
    const categories = ["Electronics", "Clothing", "Books", "Home", "Sports"] as const;
    const names = ["Pro Wireless Headphones", "Slim Fit Jacket", "Design Patterns", "Ceramic Mug Set", "Yoga Mat",
        "Mechanical Keyboard", "Linen Shirt", "Clean Code", "Bamboo Desk Organizer", "Running Shoes"];

    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `${names[i % names.length]}${i >= names.length ? ` v${Math.floor(i / names.length) + 1}` : ""}`,
        price: Math.round((9.99 + i * 4.5) * 100) / 100,
        category: categories[i % categories.length],
        description: `High-quality ${categories[i % categories.length].toLowerCase()} product built for everyday use. Features premium materials and a modern design.`,
        rating: Math.round((3.5 + (i % 3) * 0.5) * 10) / 10,
        stock: 10 + (i * 7) % 90,
        sku: `SKU-${String(i + 1).padStart(5, "0")}`,
    }));
}

function generateActivity(count: number): ActivityItem[] {
    const types = ["create", "update", "delete", "view", "comment"] as const;
    const actions = ["created", "updated", "deleted", "viewed", "commented on"];
    const targets = ["project Alpha", "Q4 report", "user onboarding doc", "release dashboard", "budget spreadsheet"];
    const users = ["alice", "bob", "carol", "dave", "eve"];

    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        user: `${users[i % users.length]}@company.example.com`,
        action: actions[i % actions.length],
        target: targets[i % targets.length],
        time: new Date(Date.now() - i * 3_600_000).toISOString(),
        type: types[i % types.length],
    }));
}

// ---------------------------------------------------------------------------
// Scenario card wrapper
// ---------------------------------------------------------------------------

type ScenarioBadge = "bad" | "moderate" | "good";

function ScenarioCard({
    badge, title, description, tip, children,
}: {
    badge: ScenarioBadge;
    title: string;
    description: string;
    tip: string;
    children: React.ReactNode;
}) {
    const styles: Record<ScenarioBadge, { badge: string; border: string; label: string }> = {
        bad: { badge: "bg-red-900/50 text-red-300 border-red-800", border: "border-red-900/40", label: "Anti-pattern" },
        moderate: { badge: "bg-yellow-900/50 text-yellow-300 border-yellow-800", border: "border-yellow-900/30", label: "Moderate" },
        good: { badge: "bg-green-900/50 text-green-300 border-green-800", border: "border-green-900/30", label: "Optimized" },
    };
    const s = styles[badge];

    return (
        <div className={`bg-zinc-900 border ${s.border} rounded-xl p-5 flex flex-col gap-4`}>
            <div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${s.badge}`}>{s.label}</span>
                <h2 className="text-base font-bold text-white mt-2">{title}</h2>
                <p className="text-sm text-zinc-400 mt-1">{description}</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg px-3 py-2 text-xs text-zinc-400 border border-zinc-700/50">
                <span className="text-zinc-500 mr-1">Turbosight tip:</span>{tip}
            </div>
            {children}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default function Home() {
    const allUsers = generateUsers(250);
    const stats = computeStats(allUsers);
    const products = generateProducts(10);
    const activity = generateActivity(6);

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <div className="border-b border-zinc-800 bg-zinc-900/50 px-8 py-5 sticky top-0 z-10 backdrop-blur">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">
                            <span className="text-blue-400">Turbo</span>sight
                        </h1>
                        <p className="text-xs text-zinc-500 mt-0.5">RSC boundary inspector — Next.js App Router</p>
                    </div>
                    <div className="flex items-center gap-5 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded border-2 border-dashed border-blue-400 inline-block" />
                            Under 50 KB
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded border-2 border-solid border-red-400 inline-block" />
                            Over budget → LCP / TBT impact
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-8 py-8 flex flex-col gap-6">
                {/* Explainer banner */}
                <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
                    <strong className="text-blue-300">How to read the overlay:</strong>{" "}
                    Every component marked with{" "}
                    <code className="bg-zinc-800 px-1 rounded text-xs">"use client"</code>{" "}
                    gets a coloured border. The label shows the component name and how many KB of data
                    crossed the server→client boundary as serialised props.{" "}
                    <strong className="text-white">Red = performance leak.</strong>{" "}
                    Blue = healthy. The SWC plugin injects the tracking automatically — no manual code needed.
                </div>

                {/* Scenario 1 — BAD: full dataset */}
                <ScenarioCard
                    badge="bad"
                    title="250 full user records passed as props"
                    description="The server fetches 250 users and sends every field — addresses, preferences, permissions — to the client. The component only displays 8 rows at a time using client-side pagination, but ALL 250 records travel over the wire."
                    tip="Look for the RED border. Even though you see 8 rows, all 250 records sit in browser memory. Fix: paginate server-side and pass only the current page."
                >
                    <HeavyUserList users={allUsers} />
                </ScenarioCard>

                {/* Scenario 2 — GOOD: aggregated summary */}
                <ScenarioCard
                    badge="good"
                    title="Same 250 users — aggregated server-side, summary only"
                    description="The server reduces the same dataset to a handful of numbers before sending. The client receives counts and percentages instead of raw records. The RSC payload drops from ~100 KB to under 1 KB."
                    tip="BLUE border, tiny payload. This is the correct pattern for any dashboard widget that only needs aggregated data."
                >
                    <UserStats stats={stats} />
                </ScenarioCard>

                {/* Scenario 3 — MODERATE: product page */}
                <ScenarioCard
                    badge="moderate"
                    title="10-item product catalog — within budget, but watch page size"
                    description="Passing a paginated product list to a client component for interactive filtering. 10 products sits under the 50 KB threshold. Adding descriptions, reviews, or image metadata to each item would quickly push it over."
                    tip="Currently BLUE. Try increasing the count to 50+ in generateProducts() to see it cross the threshold."
                >
                    <ProductGrid products={products} />
                </ScenarioCard>

                {/* Scenario 4 — GOOD: activity feed */}
                <ScenarioCard
                    badge="good"
                    title="Activity feed — 6 recent events, minimal schema"
                    description="Only the last 6 events, with only the five fields the UI actually renders. No nested user objects, no unused relation IDs, no full timestamps beyond what's needed for display."
                    tip="Smallest possible payload — under 1 KB. Use this approach for any live feed or notification list."
                >
                    <RecentActivity items={activity} />
                </ScenarioCard>
            </div>
        </div>
    );
}
