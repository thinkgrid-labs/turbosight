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
```

### 2. Wrap your root layout

```tsx
// app/layout.tsx
import { TurbosightProvider, TurbosightOverlay } from '@think-grid-labs/turbosight';
import { TurbosightSetup } from './turbosight-setup'; // see step 3

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TurbosightProvider>
          <TurbosightSetup />  {/* activates the RSC stream interceptor */}
          {children}
          <TurbosightOverlay />  {/* the visual overlay, dev-only */}
        </TurbosightProvider>
      </body>
    </html>
  );
}
```

### 3. Create the interceptor setup component

```tsx
// app/turbosight-setup.tsx
"use client";
import { useFlightStreamInterceptor } from '@think-grid-labs/turbosight';

export function TurbosightSetup() {
  useFlightStreamInterceptor();
  return null;
}
```

### 4. (Optional) Install the SWC plugin for zero-config wrapping

Without the plugin, you must manually wrap your client components (see [Manual wrapping](#manual-wrapping)).

Add the plugin to `next.config.ts`:

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    swcPlugins: [
      ['@think-grid-labs/turbosight-swc-plugin', {}],
    ],
  },
};

export default nextConfig;
```

> **Note:** The WASM plugin must be published to npm or referenced by path. See [Building the plugin](#building-the-swc-plugin) for local development.

That's it. Run `next dev` and you'll see coloured borders around every `"use client"` component.

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

### `<TurbosightProvider>`

Wraps your app. Must be a parent of all client components you want to track.

```tsx
<TurbosightProvider
  threshold={50 * 1024}  // bytes before a boundary is flagged red. Default: 50KB
>
  {children}
</TurbosightProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `51200` (50 KB) | Budget in bytes. Boundaries over this are flagged red. |

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

Set a custom threshold globally via `TurbosightProvider`:

```tsx
// Warn at 20 KB instead of the default 50 KB
<TurbosightProvider threshold={20 * 1024}>
  {children}
</TurbosightProvider>
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
| `context.tsx` | `TurbosightProvider` and `useTurbosight` hook |
| `wrapper.tsx` | `__turbosight_wrap` HOC — measures props, registers boundaries |
| `overlay.tsx` | Fixed-position visual overlay with boundary boxes |
| `interceptor.ts` | `useFlightStreamInterceptor` — RSC wire protocol parser |

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

- [ ] Dev panel / sidebar HUD with all boundaries listed and sorted by size
- [ ] Per-component budget configuration via `<TurbosightProvider budgets={{ MyComp: 20 * 1024 }}>`
- [ ] `@turbosight/next` convenience wrapper (`withTurbosight(nextConfig)`)
- [ ] Vite plugin for Remix and other RSC-capable frameworks
- [ ] `web-vitals` integration — correlate boundary sizes with real LCP/INP measurements
- [ ] Lighthouse CI integration — fail builds when a boundary exceeds budget
- [ ] VS Code extension — inline annotations in the editor

---

## License

MIT

---

## Why the Name?

**Turbo** — SWC (the Rust-based compiler Next.js uses) is orders of magnitude faster than Babel.
**Sight** — you can finally *see* what's crossing your component boundaries.
