# Turbosight — Monorepo

**Visual RSC boundary inspector for Next.js App Router.**

> Full documentation lives in [`turbosight-react-overlay/README.md`](./turbosight-react-overlay/README.md) — that file is also what gets published to npm.

---

## Packages

| Package | Description |
|---|---|
| [`@thinkgrid/turbosight`](./turbosight-react-overlay) | React overlay components, context, and flight-stream interceptor hook |
| [`@thinkgrid/turbosight-swc-plugin`](./turbosight-swc-plugin) | Rust/WASM SWC plugin that auto-wraps `"use client"` exports at compile time |
| [`test-app`](./test-app) | Next.js demo app with four real-world boundary scenarios |

---

## Quick start

```bash
# From this directory
npm install
npm run build     # build the overlay library
npm run dev       # build + start test-app dev server at http://localhost:3000
```

See the [full README](./turbosight-react-overlay/README.md) for installation, API reference, and configuration.
