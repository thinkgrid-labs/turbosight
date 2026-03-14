# Turbosight

**Visual RSC boundary inspector for Next.js App Router.**
Find performance leaks before Lighthouse does.

[![npm version](https://img.shields.io/npm/v/%40think-grid-labs%2Fturbosight?color=blue&label=%40think-grid-labs%2Fturbosight)](https://www.npmjs.com/package/@think-grid-labs/turbosight)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15%2B-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18%2B-61dafb)](https://react.dev)

> **Framework support note**
> Turbosight works best with **Next.js App Router (13.4+)** — full automatic support via the SWC plugin, overlay, and RSC flight-stream interceptor.
> The overlay library (`@think-grid-labs/turbosight`) also works with any React 18+ project using manual wrapping.
> **Remix (RSC)** and **TanStack Start** are on the roadmap once their RSC implementations stabilise.
> Next.js Pages Router and pure SPAs (Vite, CRA) are not supported — the RSC boundary problem does not exist in those architectures.

---

## The Problem

React Server Components (RSC) introduced a new performance footgun that existing tools don't catch: **passing too much data across the server→client boundary.**

This happens in any of these common patterns:

**Direct DB query → client component**
```tsx
const users = await db.users.findMany(); // 500 records
return <UserTable users={users} />;      // "use client"
```

**External API call → client component**
```tsx
const products = await fetch('https://api.store.com/products').then(r => r.json());
return <ProductGrid products={products} />;  // "use client"
```

**Server Action returning full data**
```tsx
// actions.ts
'use server'
export async function loadDashboard() {
  return await fetch('/api/analytics/full-report').then(r => r.json()); // 200KB
}

// component.tsx — the whole response crosses the boundary as props
const data = await loadDashboard();
return <DashboardCharts data={data} />;  // "use client"
```

**Forwarding third-party API responses verbatim**
```tsx
const weather = await openWeatherApi.forecast({ days: 14 }); // full API response
return <WeatherWidget forecast={weather} />;  // "use client" — only needs today's temp
```

In every case, the entire response is serialised into the RSC flight stream and sent to the browser — even when the client component only uses a fraction of the data. This silently inflates your **LCP** and **TBT** scores, and no current tooling catches it during development.

**React DevTools** shows the component tree but not payload sizes.
**Next.js Bundle Analyzer** shows JS bundle size but not data payload size.
**Lighthouse** shows the *result* of the problem but not the *cause*.

Turbosight fills that gap.

---

## What Turbosight Does

- Draws a **visual overlay** over every `"use client"` component boundary in your Next.js app during development
- Measures the **serialised props size** (bytes crossing the server→client boundary) for each boundary
- Flags boundaries that exceed a configurable budget (default: **50 KB**) with a red border, pulsing animation, and `LIGHTHOUSE IMPACT: LCP / TBT` label
- **Intercepts the RSC flight stream** (`text/x-component` responses) to refine measurements with actual wire-protocol chunk sizes
- Works automatically via an **SWC compiler plugin** — no manual component wrapping required
- **Zero production overhead** — every Turbosight component and hook is completely stripped from your production build (see [Production Safety](#production-safety) below)

---

## Production Safety

You wrap your entire app in `<TurbosightProvider>` and add `<TurbosightOverlay />` to your root layout — which raises a fair question: **does this affect production performance?**

No. Here is exactly what each piece does in a production build:

| What you add | What runs in production |
|---|---|
| `<TurbosightProvider>` | Renders `<>{children}</>` directly — one React fragment, no state, no context |
| `<TurbosightOverlay />` | Returns `null` immediately — **no hooks run**, no `MutationObserver`, no scroll/resize listeners |
| `<TurbosightSetup />` (interceptor) | `useEffect` exits on line 1 — `window.fetch` is never patched |
| `__turbosight_wrap(...)` (SWC plugin) | Returns the original component unchanged — the HOC is bypassed entirely |

**Next.js makes this even stronger:** `process.env.NODE_ENV` is a **compile-time constant**. The bundler evaluates `if ('production' !== 'development')` → `if (true)` and dead-code-eliminates every dev branch. In your production `.next` output, the Turbosight code paths simply do not exist in the JavaScript bundle.

You can safely ship `<TurbosightProvider>` in your root layout — it has the same production footprint as a plain `<>` fragment.

---

## What Turbosight Does NOT Do

| Out of scope | Why |
|---|---|
| Lighthouse score automation | Use [`@lhci/cli`](https://github.com/GoogleChrome/lighthouse-ci) for CI gating |
| JS bundle analysis | Use [`@next/bundle-analyzer`](https://www.npmjs.com/package/@next/bundle-analyzer) |
| Network waterfall profiling | Use Chrome DevTools Performance panel |
| Production monitoring | This is a dev-only tool; it renders nothing in production |
| Vite / Remix / non-Next.js frameworks | RSC flight stream format is Next.js-specific today |
| Server Component profiling | RSC itself doesn't cross the wire; only props passed to Client Components do |

---

## Security Benefit: Catching Accidental Data Exposure

> **Turbosight is a performance tool first — but it doubles as a data-exposure audit tool.**

One of the most dangerous recent RSC vulnerability patterns is **accidentally sending sensitive server-side data to the browser** because a component was marked `"use client"` or a prop was passed through a boundary without realising it.

### How it happens

```tsx
// server component — db query returns the full user row including hashed password,
// internal notes, billing info, etc.
const user = await db.users.findUnique({ where: { id } });

// "use client" — the entire object, including sensitive fields, is serialised
// into the RSC flight stream and becomes readable in the browser's network tab
return <ProfileCard user={user} />;
```

The flight stream is **not encrypted at the RSC layer** — it is plain JSON embedded in the HTML or fetched as `text/x-component`. Any field you pass as a prop is visible to anyone who opens DevTools.

### How Turbosight helps catch it

| Signal | What it means |
|---|---|
| **Red overlay on a boundary** | > 50 KB of data crossed the boundary — a strong signal to audit exactly *what* is in those props |
| **Unexpectedly large badge on a small UI** | A profile card showing 80 KB of props probably contains fields the component never renders |
| **Props size spike on navigation** | A client-side route change triggers a large RSC fetch — review which data is being sent |

### Workflow

1. Open your dev app and navigate through all key flows
2. Look for any **red badges** or any boundary with a size that seems disproportionate to its UI
3. Click into the boundary (or add a temporary `console.log(props)` in the client component) and inspect what data is actually there
4. On the server side, **select only the fields the UI needs** before passing props:

```tsx
// Before — full row crosses boundary
return <ProfileCard user={user} />;

// After — only display fields cross boundary (sensitive fields stay on server)
return (
  <ProfileCard
    name={user.name}
    avatarUrl={user.avatarUrl}
    joinedAt={user.createdAt}
  />
);
```

### What Turbosight cannot catch

| Vulnerability | Why Turbosight doesn't help |
|---|---|
| Environment variable leakage via `NEXT_PUBLIC_*` | Build-time; not reflected in RSC props size |
| CSRF / forged Server Action calls | Auth/origin-header problem, not a data-size problem |
| Server Action enumeration | Not related to boundary payload |
| Intentional sensitive data sends (e.g. passing a token in props on purpose) | Turbosight sees the size, not the semantics |

The short version: **if Turbosight shows a red boundary, treat it as a mandatory code review checkpoint — both for performance *and* for what data you are handing to the browser.**

---

## Quick Start

### 1. Install

```bash
npm install @think-grid-labs/turbosight --save-dev
npm install web-vitals --save-dev   # optional — enables Core Web Vitals correlation
```

### 2. Add `<Turbosight>` to your root layout

```tsx
// app/layout.tsx
import { Turbosight } from '@think-grid-labs/turbosight';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Turbosight>
          {children}
        </Turbosight>
      </body>
    </html>
  );
}
```

### 3. Enable the SWC plugin in `next.config.ts`

```ts
// next.config.ts
import { withTurbosight } from '@think-grid-labs/turbosight/next';

export default withTurbosight({
  // your existing Next.js config
});
```

Run `next dev` — coloured borders appear around every `"use client"` component, and the panel shows up in the bottom-right corner.

> **That's all.** No separate setup file, no manual component wrapping.
> For custom layouts or advanced configuration see [Individual components](#individual-components) and [Configuring the Budget](#configuring-the-budget).

---

## How It Works

```
┌────────────────────────────────────────────────────────┐
│  next dev / next build                                  │
│                                                         │
│  SWC Plugin (Rust/WASM)                                 │
│  ┌─────────────────────────────────────────────┐        │
│  │ Detects "use client" directive               │        │
│  │ Wraps export default with __turbosight_wrap  │        │
│  │ Injects import from @think-grid-labs/turbosight │      │
│  └─────────────────────────────────────────────┘        │
│             │                                           │
│             ▼                                           │
│  __turbosight_wrap(MyComponent, "file.tsx", "MyComp")  │
│             │                                           │
│             ▼                                           │
│  TurbosightBoundary HOC (dev-only)                      │
│  ┌─────────────────────────────────────────────┐        │
│  │ Registers component in TurbosightContext     │        │
│  │ Measures JSON.stringify(props).length        │        │
│  │ Attaches elementRef for overlay positioning  │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  useFlightStreamInterceptor (in browser)                │
│  ┌─────────────────────────────────────────────┐        │
│  │ Patches window.fetch                         │        │
│  │ Intercepts text/x-component responses        │        │
│  │ Parses RSC wire protocol (M/J/I rows)        │        │
│  │ Attributes per-chunk bytes to boundaries     │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  TurbosightOverlay (fixed, pointer-events: none)        │
│  ┌─────────────────────────────────────────────┐        │
│  │ Blue dashed border  = under budget           │        │
│  │ Red solid border    = over budget (LCP risk) │        │
│  │ Pulsing animation   = active performance leak│        │
│  └─────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

### Payload measurement — two sources

| Source | When it fires | Accuracy |
|---|---|---|
| `JSON.stringify(props).length` | Immediately on mount | Approximate (ignores RSC encoding overhead) |
| RSC flight stream parser | On RSC navigation / refresh | More accurate (actual wire bytes) |

The wrapper uses the props size as an instant baseline. The interceptor refines it on subsequent navigations.

---

## API Reference

### `<Turbosight>` (recommended)

All-in-one component. Wraps `TurbosightProvider`, activates the flight-stream interceptor and web vitals, and mounts the overlay and panel — everything in one import.

```tsx
import { Turbosight } from '@think-grid-labs/turbosight';

<Turbosight>
  {children}
</Turbosight>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `51200` (50 KB) | Global budget in bytes. |
| `budgets` | `Record<string, number>` | `{}` | Per-component budgets in bytes. |

Dev-only — zero production overhead.

---

## Individual components

Use these only if you need a custom layout (e.g. place the overlay outside a scroll container, conditionally exclude the panel, or call the hooks yourself).

### `<TurbosightProvider>`

Wraps your app. Must be a parent of all client components you want to track.

```tsx
<TurbosightProvider
  threshold={50 * 1024}   // global budget — default: 50KB
  budgets={{
    UserAvatar:  2 * 1024,   // 2KB per-component override
    DataTable:  30 * 1024,   // 30KB per-component override
  }}
>
  {children}
</TurbosightProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `51200` (50 KB) | Global budget in bytes. Applied to any component without a `budgets` entry. |
| `budgets` | `Record<string, number>` | `{}` | Per-component budgets in bytes, keyed by **component name**. Overrides `threshold` for named components. |

---

### `<TurbosightPanel>`

Floating HUD panel that lists all registered boundaries ranked by payload size. Collapsed by default — click the pill to expand.

```tsx
<TurbosightPanel />
```

No props. Place inside `<TurbosightProvider>`, alongside `<TurbosightOverlay />`.

Dev-only — returns `null` in production automatically.

---

### `withTurbosight(nextConfig, options?)`

Next.js config helper. Injects the SWC plugin into `experimental.swcPlugins` and merges with your existing config. Import from the `/next` subpath — this module has no React dependency and is safe to import in `next.config.ts`.

```ts
import { withTurbosight } from '@think-grid-labs/turbosight/next';

// Basic usage
export default withTurbosight(nextConfig);

// With a custom WASM path (local development / monorepo)
export default withTurbosight(nextConfig, {
  pluginPath: '../turbosight-swc-plugin/target/wasm32-wasip1/release/turbosight_swc_plugin.wasm',
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pluginPath` | `string` | `'@think-grid-labs/turbosight-swc-plugin'` | Path or package name of the SWC WASM plugin. |
| `pluginOptions` | `Record<string, unknown>` | `{}` | Options forwarded to the plugin. Reserved for future use. |

---

### `<TurbosightOverlay>`

Renders the visual overlay. Dev-only — returns `null` in production automatically.

```tsx
<TurbosightOverlay />
```

No props. Place inside `<TurbosightProvider>`, typically at the bottom of your root layout.

---

### `useFlightStreamInterceptor()`

Hook that patches `window.fetch` to intercept RSC flight stream responses and attribute chunk bytes to registered boundaries.

**Call this exactly once** — place it in a root-level client component (see `TurbosightSetup` pattern above). Calling it in multiple components will double-patch `fetch`.

```tsx
"use client";
import { useFlightStreamInterceptor } from '@think-grid-labs/turbosight';

export function TurbosightSetup() {
  useFlightStreamInterceptor();
  return null;
}
```

---

### `useWebVitals()`

Hook that subscribes to Core Web Vitals (LCP, INP, CLS, FCP, TTFB) via the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) library and pushes measurements into `TurbosightContext`. The panel displays these alongside boundary sizes so you can correlate an oversized boundary with a degraded LCP or INP in the same view.

**Requires** `web-vitals` to be installed (`npm install web-vitals --save-dev`). If not installed, a single warning is logged and nothing breaks.

**Call this exactly once** — add it alongside `useFlightStreamInterceptor` in your `TurbosightSetup` component:

```tsx
"use client";
import { useFlightStreamInterceptor, useWebVitals } from '@think-grid-labs/turbosight';

export function TurbosightSetup() {
  useFlightStreamInterceptor();
  useWebVitals();
  return null;
}
```

Dev-only — exits immediately in production with zero overhead.

---

### `__turbosight_wrap(Component, fileName, componentName)`

Low-level HOC used by the SWC plugin. You only need this if you are **not** using the SWC plugin (manual mode).

```tsx
"use client";
import { __turbosight_wrap } from '@think-grid-labs/turbosight';

function MyComponent({ data }: { data: SomeType[] }) {
  return <div>...</div>;
}

export default __turbosight_wrap(MyComponent, 'app/my-component.tsx', 'MyComponent');
```

> In production (`NODE_ENV !== 'development'`), `__turbosight_wrap` returns the component unchanged with zero overhead.

---

## Manual Wrapping

If you cannot use the SWC plugin, wrap your client components manually:

```tsx
"use client";
import { __turbosight_wrap } from '@think-grid-labs/turbosight';

function Dashboard({ metrics }: { metrics: Metric[] }) {
  return <div>...</div>;
}

// Replace `export default Dashboard` with:
export default __turbosight_wrap(Dashboard, 'app/dashboard.tsx', 'Dashboard');
```

The SWC plugin does this transformation automatically at compile time.

---

## Reading the Overlay

```
┌─────────────────────────────────────────────────────┐
│ ⚡ Dashboard (~3.2 KB)                               │  ← BLUE: under budget
│                                                     │
│  Dashboard content here                             │
└─────────────────────────────────────────────────────┘

┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│ ⚠️ PERFORMANCE LEAK: UserTable (~148.3 KB)          │  ← RED: over 50KB budget
│                                   LIGHTHOUSE IMPACT │
│  Table content here               LCP / TBT ❌      │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**When you see a red boundary, common fixes are:**


1. **Paginate server-side** — pass only the current page, not the full dataset
2. **Aggregate on the server** — reduce API/DB responses to summary data before passing
3. **Pass IDs, fetch inside** — pass only IDs or slugs; fetch detail data inside the client component
4. **Filter fields** — use `select` in your ORM, or destructure only needed fields from API responses
5. **Move the component server-side** — if the component doesn't need interactivity, remove `"use client"`

---

## Dev Panel HUD

The `<TurbosightPanel />` is a companion to the overlay — instead of scanning the page visually, it gives you a ranked list of every boundary sorted by payload size so you can immediately triage the worst offenders.

The panel has three built-in tools:

| Feature | How to use |
|---|---|
| **Snapshot / diff** | Click 📸 in the header, then navigate. Each boundary shows its size delta (`+62 KB` / `-2 KB`) vs the snapshot. Click ⟳ to clear. |
| **Props inspector** | Click any boundary row to expand and see which individual props are contributing to the payload, sorted largest first. |
| **History sparkline** | After 2+ navigations, each row shows a mini trend chart of the last 20 payload measurements. |

### What it looks like

**Collapsed (default):**
```
╭─────────────────────────────────────────────────╮
│  ⚡ 4 boundaries | 1 ⚠️ over budget              │   ← bottom-right pill
╰─────────────────────────────────────────────────╯
```

**Expanded with snapshot active:**
```
╭──────────────────────────────────────────────────╮
│  ⚡ Turbosight             [1 ⚠️]   📸→⟳   ✕    │
├──────────────────────────────────────────────────┤
│  Snapshot active — navigate to see size deltas.  │
├──────────────────────────────────────────────────┤
│  ▶ ● HeavyUserList   ~~~~  148.32 KB  +62.00 KB  │  ← red, sparkline, delta
│  ▶ ● ProductGrid     ~~~~   10.14 KB   -2.00 KB  │
│  ▶ ● UserStats              0.82 KB          ≈   │
╰──────────────────────────────────────────────────╯
```

**Props inspector (click ▶ to expand a row):**
```
│  ▼ ● HeavyUserList         148.32 KB             │
│      Props                                        │
│        users       →  141.20 KB                  │  ← red (> 10 KB)
│        pagination  →    0.80 KB                  │  ← gray
│        filters     →    6.32 KB                  │  ← amber (> 1 KB)
```

- **Red dot** = over budget; **Blue dot** = under budget
- Prop colors: red > 10 KB, amber > 1 KB, gray otherwise
- List is always sorted largest → smallest

### When to use the panel vs the overlay

| Tool | Best for |
|---|---|
| **Overlay** | Spatial debugging — see exactly which part of the UI the boundary maps to |
| **Panel** | Triage — ranked list, snapshot diff, props drill-down |

Both consume the same context data. Running them simultaneously has no additional overhead.

---

## Core Web Vitals Correlation

`useWebVitals()` connects RSC boundary sizes to real browser performance measurements. Once active, the panel gains a **Core Web Vitals** section at the top showing live metric values with color-coded ratings.

### What it looks like

```
╭──────────────────────────────────────────────╮
│  ⚡ Turbosight                    [1 ⚠️]  ✕  │
├──────────────────────────────────────────────┤
│  Core Web Vitals                             │
│  [LCP 3.82s]  [INP 312ms]  [CLS 0.004]      │  ← red/amber/green badges
│  ↑ Oversized boundaries may be contributing  │
│    to poor vitals                            │
├──────────────────────────────────────────────┤
│  ● HeavyUserList      heavy-user-list.tsx    │  148.32 KB
│  ● ProductGrid        product-grid.tsx       │   10.14 KB
│  ...                                         │
╰──────────────────────────────────────────────╯
```

Badge colors follow the official [Core Web Vitals thresholds](https://web.dev/articles/vitals):

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| **LCP** | < 2.5 s | 2.5 – 4 s | > 4 s |
| **INP** | < 200 ms | 200 – 500 ms | > 500 ms |
| **CLS** | < 0.1 | 0.1 – 0.25 | > 0.25 |
| **FCP** | < 1.8 s | 1.8 – 3 s | > 3 s |
| **TTFB** | < 800 ms | 800 ms – 1.8 s | > 1.8 s |

### The correlation signal

Turbosight cannot prove that a specific boundary *caused* a specific metric value — too many factors affect real-world vitals. What it does is show both pieces of information in the same view so you can make the connection yourself:

> "My LCP is 3.8 s (poor) **and** I have a 148 KB boundary on this page. That boundary serialises ~148 KB into the RSC flight stream on every navigation, which inflates the HTML payload and delays the browser's ability to render the largest content."

When both conditions are true simultaneously — an over-budget boundary **and** a poor LCP or INP — the panel shows the note: *"↑ Oversized boundaries may be contributing to poor vitals"*.

### Metrics and what they connect to RSC boundaries

| Metric | RSC connection |
|---|---|
| **LCP** | Large flight-stream payloads inflate the HTML or RSC fetch response, delaying the browser from painting the largest visible element |
| **INP** | Hydrating large client components blocks the main thread, increasing interaction latency |
| **CLS** | Usually unrelated to RSC payloads — useful context but not a direct signal |
| **FCP** | Similar to LCP — large payloads delay first content |
| **TTFB** | Reflects server response time, not RSC payload size |

### Setup

1. Install `web-vitals`:
   ```bash
   npm install web-vitals --save-dev
   ```

2. Add `useWebVitals()` to your `TurbosightSetup` component:
   ```tsx
   "use client";
   import { useFlightStreamInterceptor, useWebVitals } from '@think-grid-labs/turbosight';

   export function TurbosightSetup() {
     useFlightStreamInterceptor();
     useWebVitals();   // ← add this line
     return null;
   }
   ```

That's it. The panel vitals section appears automatically once the first metric fires (LCP fires after the page's largest element paints; INP fires after the first interaction).

> **Note:** Vitals only report meaningful values in a real browser session — not in `next build` output or Lighthouse CI. For CI gating on Lighthouse scores, see the [Lighthouse CI integration](#roadmap) roadmap item.

---

## Real-World Use Cases

Turbosight catches oversized boundaries regardless of how the data arrives on the server.

### REST / GraphQL API calls

```tsx
// ❌ Full API response forwarded to client
async function ProductsPage() {
  const { data } = await shopifyApi.getProducts({ limit: 250 }); // huge response
  return <ProductGrid products={data.products} />;  // "use client"
}

// ✅ Map to only what the UI needs
async function ProductsPage() {
  const { data } = await shopifyApi.getProducts({ limit: 250 });
  const slim = data.products.map(({ id, title, price, imageUrl }) => ({ id, title, price, imageUrl }));
  return <ProductGrid products={slim} />;  // "use client" — fraction of the size
}
```

### Server Actions returning data

```tsx
// actions.ts
'use server'

// ❌ Returns the entire analytics report object
export async function getReport() {
  return fetch('/api/reports/full').then(r => r.json()); // 300KB
}

// ✅ Aggregate before returning — the action is the transformation layer
export async function getReportSummary() {
  const full = await fetch('/api/reports/full').then(r => r.json());
  return {
    totalRevenue: full.revenue.total,
    topProduct: full.products.sort((a, b) => b.sales - a.sales)[0]?.name,
    period: full.meta.period,
  }; // < 1KB
}
```

### Third-party SDKs (Stripe, Contentful, Notion, etc.)

```tsx
// ❌ Raw SDK response passed through
const entries = await contentful.getEntries({ content_type: 'blogPost' });
return <BlogList entries={entries.items} />;  // "use client"

// ✅ Shape the data for the component, not the SDK
const entries = await contentful.getEntries({ content_type: 'blogPost' });
const posts = entries.items.map(e => ({
  id: e.sys.id,
  title: e.fields.title,
  slug: e.fields.slug,
  publishedAt: e.sys.createdAt,
}));
return <BlogList posts={posts} />;  // "use client"
```

### Service layer / repository pattern

```tsx
// ❌ Repository returns full domain object
const order = await orderRepository.findById(id); // full order + nested relations
return <OrderSummary order={order} />;  // "use client"

// ✅ Add a projection method for client-safe data
const order = await orderRepository.findSummaryById(id); // { id, total, status, itemCount }
return <OrderSummary order={order} />;  // "use client"
```

---

## Building the SWC Plugin

The WASM plugin must be compiled from Rust. Requirements: [Rust](https://rustup.rs) + `wasm32-wasip1` target.

```bash
# Install the WASM target (one time)
rustup target add wasm32-wasip1

# Build
cd turbosight-swc-plugin
cargo build --target wasm32-wasip1 --release

# Output: target/wasm32-wasip1/release/turbosight_swc_plugin.wasm
```

Reference it in `next.config.ts`:

```ts
swcPlugins: [
  [
    './path/to/turbosight_swc_plugin.wasm',
    {},
  ],
],
```

---

## Monorepo Scripts

From the `packages/` root:

```bash
npm run build          # Build @think-grid-labs/turbosight
npm run build:plugin   # Build the Rust WASM SWC plugin
npm run dev            # Build overlay then start test-app dev server
npm run dev:overlay    # Watch-rebuild the overlay library only
npm run dev:app        # Start test-app dev server only
```

---

## Demo App (test-app)

The `test-app` showcases four real-world boundary patterns:

| Scenario | What crosses the boundary | Expected result |
|---|---|---|
| Full user list | 250 user objects with all fields | Red — ~100 KB |
| Aggregated stats | Counts and percentages only | Blue — < 1 KB |
| Product catalog | 10 products with descriptions | Blue — ~10 KB |
| Activity feed | 6 recent events, minimal fields | Blue — < 1 KB |

```bash
# Run the demo
cd packages
npm run dev
# → http://localhost:3000
```

---

## Configuring the Budget

### Global threshold

Set a single budget for all boundaries via `threshold` (default: 50 KB):

```tsx
// Warn at 20 KB instead of the default 50 KB
<TurbosightProvider threshold={20 * 1024}>
  {children}
</TurbosightProvider>
```

### Per-component budgets

Use the `budgets` prop to set different limits for individual components. The key is the **component function name** exactly as it appears in your source.

```tsx
<TurbosightProvider
  threshold={50 * 1024}   // fallback for anything not listed below
  budgets={{
    UserAvatar:    2 * 1024,   //  2 KB — tiny profile card, should be minimal
    ProductGrid:  15 * 1024,   // 15 KB — 10 products is acceptable
    DataTable:    40 * 1024,   // 40 KB — intentionally data-heavy
  }}
>
  {children}
</TurbosightProvider>
```

Any component whose name is **not** in `budgets` falls back to the global `threshold`.

### When to use per-component budgets

| Scenario | Recommended approach |
|---|---|
| All components are similar in scope | Global `threshold` only — keep it simple |
| Some components are legitimately data-heavy | Set a higher budget for those specific components so they don't create noise |
| Some components should be very lean (avatars, pills, badges) | Set a tight budget (1–5 KB) so even small regressions are caught |
| You want to enforce contracts between teams | Encode the agreed budget directly in `budgets` as a checked constraint |

### Real-world example

```tsx
// app/layout.tsx
<TurbosightProvider
  threshold={50 * 1024}
  budgets={{
    // Presentational atoms — should never be bloated
    Avatar:         1 * 1024,
    StatusBadge:    1 * 1024,
    PricingPill:    2 * 1024,

    // Mid-weight interactive components
    ProductCard:   10 * 1024,
    CommentThread: 20 * 1024,

    // Known heavy components — explicit allowance with a ceiling
    ReportChart:   80 * 1024,
    OrderHistory: 100 * 1024,
  }}
>
```

---

## Framework Compatibility

### Currently supported

| Framework | Status | Notes |
|---|---|---|
| **Next.js 14+ App Router** | ✅ Full support | SWC plugin + overlay + flight stream interceptor |
| **Next.js 13.4+ App Router** | ✅ Full support | Minimum version with `experimental.swcPlugins` |

### Partial / manual support

| Framework | Status | Notes |
|---|---|---|
| **Any RSC-capable React app** | ⚡ Manual wrapping | The overlay library works with any React 18+ app. Use `__turbosight_wrap` manually and skip the SWC plugin |
| **Remix (v3 RSC)** | 🔜 Roadmap | Awaiting stable RSC support in Remix v3 |
| **TanStack Start** | 🔜 Roadmap | Awaiting stable RSC / server function boundary APIs |

### Not supported

| Framework / Setup | Reason |
|---|---|
| **Next.js Pages Router** | No RSC boundaries exist in Pages Router |
| **Create React App / Vite SPA** | No server→client boundary; the problem doesn't apply |
| **Next.js 13 before 13.4** | No `experimental.swcPlugins` API |

> **Short answer:** Turbosight is built specifically for **Next.js App Router**. The visual overlay React library (`@think-grid-labs/turbosight`) works in any React 18+ project, but the flight-stream measurement only produces meaningful results when RSC is in use.

### Runtime requirements

| Dependency | Supported version |
|---|---|
| Next.js | 13.4, 14, 15, 16 |
| React | 18, 19 |
| Node.js | 18+ |
| Rust (plugin builds only) | stable toolchain |

---

## Contributing

Contributions are welcome. The repository is structured as an npm workspace:

```
packages/
├── turbosight-react-overlay/   # TypeScript/React — the overlay library
├── turbosight-swc-plugin/      # Rust — the SWC transform plugin
└── test-app/                   # Next.js — integration test and demo
```

**React library** (`@think-grid-labs/turbosight` → `turbosight-react-overlay/src/`):

| File | Responsibility |
|---|---|
| `context.tsx` | `TurbosightProvider` and `useTurbosight` hook; `threshold` + `budgets` + `getBudget` |
| `wrapper.tsx` | `__turbosight_wrap` HOC — measures props, registers boundaries |
| `overlay.tsx` | Fixed-position visual overlay with per-component-aware boundary boxes |
| `interceptor.ts` | `useFlightStreamInterceptor` — RSC wire protocol parser |
| `panel.tsx` | `TurbosightPanel` — floating HUD listing boundaries ranked by size |

**SWC plugin** (`turbosight-swc-plugin/src/lib.rs`):

- `ExprExportVisitor` — handles `export default <expr>` (identifiers, arrows)
- `transform_default_decl` — handles `export default function Foo(){}` (requires AST node-type swap)
- `process_transform` — plugin entry point; detects `"use client"`, runs both passes, injects import

### Development workflow

```bash
# Overlay library — rebuild on change
cd turbosight-react-overlay && npm run dev

# SWC plugin — recompile after Rust changes
cd turbosight-swc-plugin && cargo build --target wasm32-wasip1 --release

# Test app
cd test-app && npm run dev
```

---

## Roadmap

- [x] Dev panel / sidebar HUD with all boundaries listed and sorted by size
- [x] Per-component budget configuration via `<TurbosightProvider budgets={{ MyComp: 20 * 1024 }}>`
- [x] `@turbosight/next` convenience wrapper (`withTurbosight(nextConfig)`)
- [ ] Vite plugin for Remix and other RSC-capable frameworks
- [x] `web-vitals` integration — correlate boundary sizes with real LCP/INP measurements
- [ ] Lighthouse CI integration — fail builds when a boundary exceeds budget
- [ ] VS Code extension — inline annotations in the editor

---

## License

MIT

---

## Why the Name?

**Turbo** — SWC (the Rust-based compiler Next.js uses) is orders of magnitude faster than Babel.
**Sight** — you can finally *see* what's crossing your component boundaries.
