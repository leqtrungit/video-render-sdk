# Solution Architecture Document

## Video Render SDK

> **Version:** 0.1.0 (Draft)
> **Date:** 2026-02-22
> **Status:** In Review

---

## 1. Overview

The **Video Render SDK** is a TypeScript-first, monorepo-based SDK that provides web applications with a unified, hardware-agnostic video rendering pipeline. It abstracts away the complexity of client-side vs. server-side rendering, exposing a single API surface regardless of where rendering actually happens.

```
┌────────────────────────────────────────────────┐
│                  Application                   │
│     (React / Vue / Vanilla TS / Node.js)       │
└────────────────┬───────────────────────────────┘
                 │  Single Unified API
┌────────────────▼───────────────────────────────┐
│            @vrs/core  (Shared Layer)            │
│  Schema · Validation · Hardware Assessment     │
│  Auto-switch Logic · Progress Events           │
└──────────┬──────────────────────┬──────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼──────────────┐
│    @vrs/client      │  │     @vrs/server       │
│  FFmpeg.wasm        │  │  fluent-ffmpeg        │
│  WebCodecs API      │  │  (Node.js + FFmpeg)   │
│  (Browser)          │  │  SSE Progress Server  │
└─────────────────────┘  └──────────────────────┘
```

---

## 2. Architectural Decisions

### 2.1 Monorepo Structure (Turborepo + npm workspaces)

Three focused packages under a single repository:

| Package       | Runtime        | Responsibility                                                                |
| ------------- | -------------- | ----------------------------------------------------------------------------- |
| `@vrs/core`   | Browser + Node | Unified schema, validation, hardware assessment, auto-switch logic, event bus |
| `@vrs/client` | Browser only   | FFmpeg.wasm renderer, WebCodecs decoder, progress emitter                     |
| `@vrs/server` | Node.js only   | fluent-ffmpeg renderer, SSE HTTP server, job queue                            |

**Rationale:** Keeps browser and Node bundles separate (no server-only deps in the client bundle), while sharing all business logic through `@vrs/core`. Framework adapters are explicitly out-of-scope for MVP.

---

### 2.2 Unified Project Schema

All video projects are described by a single **version-stamped JSON schema** (no executable code allowed per NFR Security).

```typescript
// Defined in @vrs/core/schema

interface VideoProject {
  version: string; // e.g. "1.0"
  output: OutputSettings;
  tracks: Track[];
}

interface OutputSettings {
  width: number;
  height: number;
  fps: number; // e.g. 30 | 60
  format: 'mp4' | 'webm' | 'gif';
  codec?: 'h264' | 'h265' | 'vp9' | 'av1';
  bitrate?: string; // e.g. "4M"
  duration: number; // seconds
}

interface Track {
  id: string;
  type: 'video' | 'audio' | 'image' | 'text';
  startTime: number;
  duration: number;
  source?: string; // URL or base64 data URI
  effects?: Effect[];
  transform?: Transform;
}

interface Effect {
  type: string; // e.g. "fade", "blur", "colorCorrect"
  params: Record<string, unknown>;
  startTime?: number;
  endTime?: number;
}

interface Transform {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}
```

- Schema is validated at runtime using **Zod** (zero-dependency type-safe validation).
- Schema is versioned — the SDK will emit a clear error if `version` is unsupported.
- Schema **never** contains executable code; all rendering logic lives in SDK packages.

---

### 2.3 Client-Side Rendering (`@vrs/client`)

**Technology Stack:**

- **FFmpeg.wasm (`@ffmpeg/ffmpeg`)** — video encoding/compositing in the browser via WebAssembly
- **WebCodecs API** — hardware-accelerated video/audio _decoding_ (where browser support permits), used to feed frames into the compositor at maximum speed
- **OffscreenCanvas + Web Workers** — rendering pipeline runs off the main thread to avoid UI jank

**Rendering Pipeline:**

```
Input Assets (URL / Blob)
        │
        ▼
┌──────────────────────┐
│  Asset Loader        │ — fetch, cache, decode via WebCodecs
└──────────┬───────────┘
           │  Raw frames (VideoFrame / ImageBitmap)
           ▼
┌──────────────────────┐
│  Compositor          │ — apply Transform, Effects, tiling
│  (OffscreenCanvas)   │   per-frame in a Web Worker
└──────────┬───────────┘
           │  Composited frames
           ▼
┌──────────────────────┐
│  FFmpeg.wasm Encoder │ — encode to mp4/webm/gif
└──────────┬───────────┘
           │
           ▼
     Uint8Array (video blob) → downloadable File
```

**WebCodecs Graceful Degradation:** If `VideoDecoder` is unavailable (older browsers), the SDK falls back to an `<HTMLVideoElement>`-based frame extraction approach automatically.

---

### 2.4 Server-Side Rendering (`@vrs/server`)

**Technology Stack:**

- **fluent-ffmpeg** — high-level Node.js wrapper around the system FFmpeg binary
- **Express.js** (lightweight) — HTTP server exposing the render API
- **Server-Sent Events (SSE)** — real-time progress streaming to the client
- **In-memory job queue** (MVP) with simple FIFO — upgradeable to Bull/BullMQ for production

**Rendering Pipeline:**

```
POST /jobs  (VideoProject JSON)
        │
        ▼
┌──────────────────────┐
│  Schema Validator    │ — reuses @vrs/core Zod schema
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Job Queue           │ — assigns jobId, returns immediately
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  fluent-ffmpeg       │ — builds filter_complex graph from
│  Compositor          │   project schema, runs FFmpeg process
└──────────┬───────────┘
           │  stdout progress events
           ▼
┌──────────────────────┐
│  SSE Progress Stream │ — GET /jobs/:id/progress
│  (per-job EventSource│   emits { percent, status, message }
└──────────┬───────────┘
           │
           ▼
     Output file → GET /jobs/:id/download
```

**Server REST API:**

| Method   | Path                 | Description                                                   |
| -------- | -------------------- | ------------------------------------------------------------- |
| `POST`   | `/jobs`              | Submit a render job. Returns `{ jobId }`.                     |
| `GET`    | `/jobs/:id`          | Get job status (`queued`, `rendering`, `done`, `failed`).     |
| `GET`    | `/jobs/:id/progress` | SSE stream of `{ percent, status, message }` events.          |
| `GET`    | `/jobs/:id/download` | Download the rendered video file.                             |
| `DELETE` | `/jobs/:id`          | Cancel a running or queued job.                               |
| `GET`    | `/health`            | Server capacity info: `{ load, availableSlots, cpuPercent }`. |

---

### 2.5 Hardware Assessment (`@vrs/core`)

**Client Assessment:**

```typescript
interface ClientCapabilities {
  logicalCores: number; // navigator.hardwareConcurrency
  deviceMemoryGB: number; // navigator.deviceMemory
  gpuRenderer: string; // from WebGL RENDERER string
  webCodecsSupported: boolean;
  estimatedTier: 'low' | 'medium' | 'high';
}
```

Tier thresholds (configurable):

| Tier     | Condition                |
| -------- | ------------------------ |
| `low`    | < 4 cores OR < 4 GB RAM  |
| `medium` | 4–7 cores AND 4–8 GB RAM |
| `high`   | ≥ 8 cores AND ≥ 8 GB RAM |

**Server Assessment:**

- `GET /health` returns current CPU load, available render slots
- SDK uses this before deciding to offload

---

### 2.6 Auto-Switch Logic (`@vrs/core`)

The `auto` mode decision tree:

```
render(project, { mode: 'auto' })
         │
         ▼
  Assess client tier
         │
    ┌────┴────┐
  'high'    'medium' or 'low'
    │              │
    │         Ping /health
    │              │
    │         ┌────┴─────┐
    │      server      server
    │      available   at capacity
    │              │
    │         Try local anyway
    │         (with timeout)
    │              │
    ▼              ▼
 Local render  Server render
```

All decisions are emitted as events for full transparency:

```typescript
sdk.on('decision', (event: DecisionEvent) => {
  // { reason: "client_tier_high" | "server_available" | "server_full_fallback_local", mode: "local" | "remote" }
  console.log(event);
});
```

---

### 2.7 Unified API (Consumer-facing)

```typescript
import { VideoRenderSDK } from '@vrs/core';
import { ClientRenderer } from '@vrs/client';
import { ServerRenderer } from '@vrs/server'; // import only for Node consumers

const sdk = new VideoRenderSDK({
  mode: 'auto', // 'local' | 'remote' | 'auto'
  serverUrl: 'http://localhost:3000',
  renderers: {
    client: new ClientRenderer(),
    server: new ServerRenderer(), // optional; omit in pure browser usage
  },
  logLevel: 'info',
});

// Start render
const job = await sdk.render(project);

// Real-time progress
job.on('progress', ({ percent, status }) => {
  console.log(`${percent}% — ${status}`);
});

// Await completion
const result = await job.result();
// result.blob — video Blob (browser) or result.filePath (Node)

// Cancel
await job.cancel();
```

---

### 2.8 Plugin System

> **Note:** Full plugin design is deferred post-MVP. The following is the intended direction.

Plugins are **pure TypeScript functions** registered at SDK initialization. They extend the `Effect` node type with custom compositing logic. A plugin has two implementations — one for the browser compositor and one for the FFmpeg filter graph builder — both conforming to the same interface.

```typescript
interface EffectPlugin {
  type: string; // must match Effect.type in schema
  clientApply: (frame: OffscreenCanvas, params: Record<string, unknown>) => void; // runs in Web Worker, browser only
  serverFilter: (params: Record<string, unknown>) => string; // returns an FFmpeg filtergraph fragment
}

// Registration
sdk.registerPlugin(myGlitchEffect);
```

Plugins **cannot** contain network calls or file I/O — sandboxing will be enforced at the API level.

---

## 3. Repository Structure

```
video-render-sdk/
├── packages/
│   ├── core/                   # @vrs/core
│   │   ├── src/
│   │   │   ├── schema/         # Zod schemas, TypeScript types
│   │   │   ├── assessment/     # Hardware detection
│   │   │   ├── switcher/       # Auto-switch logic
│   │   │   ├── events/         # EventEmitter, DecisionEvent types
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── client/                 # @vrs/client
│   │   ├── src/
│   │   │   ├── loader/         # Asset fetch + WebCodecs decoder
│   │   │   ├── compositor/     # OffscreenCanvas Web Worker pipeline
│   │   │   ├── encoder/        # FFmpeg.wasm wrapper
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── server/                 # @vrs/server
│       ├── src/
│       │   ├── api/            # Express routes
│       │   ├── queue/          # Job queue (in-memory MVP)
│       │   ├── renderer/       # fluent-ffmpeg compositor
│       │   ├── sse/            # SSE progress emitter
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
│   ├── prd.md
│   └── architect.md            # This document
│
├── turbo.json
├── package.json                # npm workspaces root
└── tsconfig.base.json
```

---

## 4. Technology Stack

### 4.1 Language & Toolchain

| Concern                 | Choice                        | Version    | Notes                                                    |
| ----------------------- | ----------------------------- | ---------- | -------------------------------------------------------- |
| Language                | TypeScript                    | `^5.4`     | Strict mode enabled across all packages                  |
| Runtime (server)        | Node.js                       | `>=20 LTS` | Required for native SSE, `node:stream`, `worker_threads` |
| Package Manager         | npm workspaces                | `>=10`     | Native workspace support; no extra tooling               |
| Monorepo Orchestrator   | Turborepo                     | `^2.x`     | Remote caching, parallel task graph                      |
| Bundler (`@vrs/client`) | Vite (library mode)           | `^5.x`     | Tree-shaking, WASM asset handling, ESM output            |
| Bundler (`@vrs/server`) | tsup                          | `^8.x`     | Fast ESM + CJS dual-output for Node libraries            |
| Bundler (`@vrs/core`)   | tsup                          | `^8.x`     | Shared between browser + Node, no DOM deps               |
| Linter                  | ESLint + `@typescript-eslint` | `^8.x`     | Enforces no-any, consistent-type-imports                 |
| Formatter               | Prettier                      | `^3.x`     | Single config at root, applied via lint-staged           |
| Git Hooks               | Husky + lint-staged           | latest     | Pre-commit: lint + format; pre-push: typecheck           |

### 4.2 `@vrs/core` — Shared Layer

| Concern            | Choice                                                         | Rationale                                                                    |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Schema definition  | **Zod** `^3.x`                                                 | Runtime validation + inferred TypeScript types from a single source of truth |
| EventEmitter       | Node.js `EventEmitter` / `eventemitter3` (browser compat)      | Lightweight, familiar API for progress/decision events                       |
| UUID generation    | `crypto.randomUUID()` (built-in)                               | No dependency; available in Node ≥ 19 and modern browsers                    |
| Hardware detection | Browser: `navigator.*` APIs + WebGL context; Node: `os` module | Zero deps; polyfillable for test environments                                |

### 4.3 `@vrs/client` — Browser Renderer

| Concern               | Choice                                                  | Rationale                                                                   |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Video encoding (WASM) | **`@ffmpeg/ffmpeg` + `@ffmpeg/core-mt`**                | Multi-threaded WASM build for parallel encoding                             |
| WASM threading        | `SharedArrayBuffer` + `COOP/COEP` headers               | Required for FFmpeg.wasm multi-thread; server must set these headers        |
| Video/audio decoding  | **WebCodecs API** (`VideoDecoder`, `AudioDecoder`)      | Hardware-accelerated; drastically reduces decode time vs. `<video>` element |
| Fallback decoder      | `<HTMLVideoElement>` + `OffscreenCanvas.drawImage()`    | Graceful degradation when WebCodecs is unavailable                          |
| Compositing thread    | **OffscreenCanvas** transferred to a **Web Worker**     | Keeps main thread free; no UI jank during rendering                         |
| Asset caching         | `Cache API` (Service Worker) or `Map<url, ArrayBuffer>` | Avoid re-fetching assets across frames                                      |
| Type definitions      | `@types/wicg-*` (WebCodecs community types)             | TypeScript support for experimental browser APIs                            |

> [!IMPORTANT]
> The server hosting the app **must** set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers to enable `SharedArrayBuffer` — a hard requirement for FFmpeg.wasm multi-thread mode.

### 4.4 `@vrs/server` — Node.js Renderer

| Concern                | Choice                                                      | Rationale                                                                                |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| FFmpeg wrapper         | **fluent-ffmpeg** `^2.x`                                    | High-level builder API for `filter_complex` graphs; strong community                     |
| FFmpeg binary          | System-installed FFmpeg (≥ 6.0)                             | Not bundled; documented as a peer requirement. Consumers install via `brew`, `apt`, etc. |
| HTTP framework         | **Express.js** `^4.x`                                       | Minimal footprint; well-understood middleware model                                      |
| SSE implementation     | Native `res.write()` with `Content-Type: text/event-stream` | No library needed; full control over event format                                        |
| Request validation     | Zod (reused from `@vrs/core`)                               | Consistent validation between packages                                                   |
| Job queue (MVP)        | In-memory `Map<jobId, Job>` with async FIFO runner          | Zero deps for MVP                                                                        |
| Job queue (Production) | **BullMQ** + Redis _(upgrade path)_                         | Persistent, distributed, retryable jobs                                                  |
| Temp file management   | `node:fs/promises` + `node:os.tmpdir()`                     | Output files written to OS temp dir; cleaned after download                              |
| Process management     | `node:child_process` (via fluent-ffmpeg)                    | FFmpeg runs as a child process; cancellable via `SIGKILL`                                |

### 4.5 Developer Experience & Documentation

| Concern   | Choice                                   | Rationale                                                 |
| --------- | ---------------------------------------- | --------------------------------------------------------- |
| API docs  | **TypeDoc**                              | Auto-generated from TSDoc comments; hosted as static HTML |
| Changelog | **Changesets**                           | Per-package semantic versioning; automates `CHANGELOG.md` |
| Examples  | `packages/*/examples/` (plain HTML + TS) | Framework-agnostic; runnable via `vite` dev server        |
| CI/CD     | GitHub Actions                           | Test, lint, typecheck, build on every PR                  |

---

## 5. Testing Strategy

The SDK has four distinct testing layers, each with a clear scope and tooling choice.

```
┌─────────────────────────────────────────────────┐
│  Layer 4: Conformance / Visual (Output Quality) │  ← Cross-renderer frame diff
├─────────────────────────────────────────────────┤
│  Layer 3: End-to-End (E2E)                      │  ← Full render pipeline
├─────────────────────────────────────────────────┤
│  Layer 2: Integration                           │  ← Package boundaries
├─────────────────────────────────────────────────┤
│  Layer 1: Unit                                  │  ← Pure functions & schemas
└─────────────────────────────────────────────────┘
```

### 5.1 Tooling Overview

| Tool                            | Version | Used For                                                          |
| ------------------------------- | ------- | ----------------------------------------------------------------- |
| **Vitest**                      | `^2.x`  | Unit + integration tests (Node & browser via `jsdom`/`happy-dom`) |
| **Playwright**                  | `^1.x`  | E2E browser tests (Chromium, Firefox, WebKit)                     |
| **psnr / ssim** (custom script) | —       | Frame-level conformance checking (client vs. server output)       |
| **Supertest**                   | `^7.x`  | HTTP API integration tests for `@vrs/server`                      |
| **MSW (Mock Service Worker)**   | `^2.x`  | Mock server `/health` endpoint in client-side tests               |
| **@vitest/coverage-v8**         | `^2.x`  | Code coverage reports (Istanbul format)                           |

### 5.2 Layer 1 — Unit Tests

**Scope:** Pure functions, schema validation, hardware tier calculation, auto-switch decision logic.

**Location:** `packages/*/src/**/*.test.ts` co-located with source.

**Runner:** Vitest (Node environment).

```typescript
// Example: @vrs/core — schema validation
import { describe, it, expect } from 'vitest';
import { VideoProjectSchema } from '@vrs/core/schema';

describe('VideoProjectSchema', () => {
  it('rejects a project missing output.fps', () => {
    const result = VideoProjectSchema.safeParse({ version: '1.0', output: {}, tracks: [] });
    expect(result.success).toBe(false);
  });

  it('parses a valid minimal project', () => {
    const result = VideoProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });
});

// Example: @vrs/core — hardware tier
describe('assessClientTier', () => {
  it('returns "low" for 2-core, 2GB device', () => {
    expect(assessClientTier({ cores: 2, memoryGB: 2 })).toBe('low');
  });
});
```

**Coverage target:** ≥ 90% line coverage on `@vrs/core`.

### 5.3 Layer 2 — Integration Tests

**Scope:** Package-level boundaries — server HTTP API, SSE stream format, client renderer module wiring.

**Sub-layer A — Server API (`@vrs/server`):**

Runner: Vitest (Node) + Supertest. A real Express server is spun up in-process; no network. FFmpeg runs against a tiny synthetic test asset (1-second, 10-frame clip committed to `fixtures/`).

```typescript
// @vrs/server — job submission and SSE
import request from 'supertest';
import { createApp } from '@vrs/server';

const app = createApp();

it('POST /jobs returns a jobId', async () => {
  const res = await request(app).post('/jobs').send(minimalProject);
  expect(res.status).toBe(202);
  expect(res.body.jobId).toBeDefined();
});

it('GET /health returns server capacity', async () => {
  const res = await request(app).get('/health');
  expect(res.body).toMatchObject({
    availableSlots: expect.any(Number),
    cpuPercent: expect.any(Number),
  });
});
```

**Sub-layer B — Client Renderer (`@vrs/client`):**

Runner: Vitest with `happy-dom` environment. FFmpeg.wasm is mocked at the module boundary (the WASM binary does not run in unit/integration tests).

```typescript
// Mock FFmpeg.wasm
vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: vi.fn(() => mockFfmpeg) }));

it('ClientRenderer emits progress events', async () => {
  const renderer = new ClientRenderer();
  const events: number[] = [];
  renderer.on('progress', (e) => events.push(e.percent));
  await renderer.render(minimalProject);
  expect(events.at(-1)).toBe(100);
});
```

### 5.4 Layer 3 — End-to-End Tests

**Scope:** Full render pipeline from a real browser tab to a real server; validates the complete `auto` mode flow.

**Runner:** Playwright (Chromium only for MVP E2E; extend to Firefox/WebKit post-MVP).

**Setup:**

- The `@vrs/server` HTTP server starts on a random port before the test suite.
- A minimal Vite dev server serves a test harness HTML page that imports `@vrs/client`.
- Playwright navigates to the test page and triggers a render via the SDK API.

```typescript
// e2e/render.spec.ts
import { test, expect } from '@playwright/test';

test('auto mode: completes a render and returns a blob URL', async ({ page }) => {
  await page.goto('http://localhost:5173/test-harness.html');
  await page.evaluate(() => window.__startRender(/* minimalProject */));

  // Assert progress reaches 100%
  await expect(page.locator('#progress')).toHaveText('100%', { timeout: 60_000 });

  // Assert download link appears
  await expect(page.locator('#download-link')).toBeVisible();
});

test('server fallback: switches to remote when client tier is low', async ({ page }) => {
  // Override hardware detection to simulate a low-tier device
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 });
  });
  // ... assert DecisionEvent reason === 'server_available'
});
```

**E2E test matrix:**

| Scenario               | Mode     | Expected outcome                                      |
| ---------------------- | -------- | ----------------------------------------------------- |
| Happy path (local)     | `local`  | Render completes, blob URL returned                   |
| Happy path (remote)    | `remote` | Job submitted, SSE progress 0→100%, file downloadable |
| Auto: high-tier client | `auto`   | Routes local                                          |
| Auto: low-tier client  | `auto`   | Routes remote                                         |
| Server at capacity     | `auto`   | Falls back to local with `DecisionEvent`              |
| Cancel in-flight job   | `remote` | Job status becomes `cancelled`                        |

### 5.5 Layer 4 — Conformance / Visual Tests

**Goal:** Ensure `< 1% variance` between client and server renders (NFR from PRD §7).

**Method:**

1. Define a set of **reference projects** in `fixtures/conformance/` covering common scenarios (text overlay, video clip, fade transition, audio track).
2. Run each project through **both** `ClientRenderer` and `ServerRenderer`.
3. Extract a sample of frames (frame 1, middle frame, last frame) from each output video using FFmpeg.
4. Compute **PSNR** (Peak Signal-to-Noise Ratio) and **SSIM** (Structural Similarity Index) between corresponding frames.
5. Assert PSNR ≥ 40 dB (perceptually lossless threshold).

```bash
# scripts/conformance.sh — runs after E2E in CI
npx tsx scripts/run-conformance.ts
# Outputs:
# ✓ text_overlay    PSNR: 48.2 dB  SSIM: 0.9981
# ✓ fade_transition PSNR: 45.7 dB  SSIM: 0.9963
# ✗ color_correct   PSNR: 31.1 dB  SSIM: 0.9712  ← FAIL
```

**Runner location:** `packages/conformance/` (a private workspace package, not published).

### 5.6 CI Pipeline

```yaml
# .github/workflows/ci.yml  (simplified)
jobs:
  test:
    steps:
      - name: Typecheck (all packages)
        run: npx turbo run typecheck

      - name: Unit + Integration tests
        run: npx turbo run test # runs vitest per package in parallel

      - name: Coverage gate
        run: npx vitest run --coverage
        # Fails if @vrs/core coverage < 90%

      - name: E2E tests
        run: npx playwright test
        # Requires FFmpeg on CI runner (installed via apt)

      - name: Conformance tests
        run: npx tsx scripts/run-conformance.ts
        # Fails if any PSNR < 40 dB
```

**CI environment requirements:**

- `ubuntu-latest` runner with FFmpeg ≥ 6.0 installed
- `COOP/COEP` headers enabled in the Vite test server for `SharedArrayBuffer`
- Playwright browsers installed via `npx playwright install chromium`

---

## 6. Non-Functional Requirements Mapping

| NFR                      | Addressed By                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| First render < 30 min    | Simple unified API; working demo in `packages/*/examples/`            |
| Framework agnostic       | `@vrs/core` has zero DOM/framework deps                               |
| Transparency             | `sdk.on('decision', ...)` event for every automated choice            |
| Security                 | Zod schema rejects executable content; plugins are pure functions     |
| < 1% output variance     | Conformance tests (Layer 4) enforce PSNR ≥ 40 dB gate in CI           |
| > 95% auto-mode accuracy | Hardware tier scoring + `/health` live query; validated in E2E matrix |

---

## 7. Open Questions & Future Work

| Topic                 | Status             | Notes                                                              |
| --------------------- | ------------------ | ------------------------------------------------------------------ |
| Plugin sandboxing     | Deferred           | Evaluate using a `MessageChannel` or Compartment API for isolation |
| Job persistence       | Deferred           | Replace in-memory queue with BullMQ + Redis for production         |
| Distributed rendering | Future             | Split a single project across multiple server workers              |
| Native mobile         | Out of scope (MVP) | Mentioned in PRD as future possibility                             |
| Cloud SaaS tier       | Out of scope (MVP) | Full self-hosting is the near-term goal                            |
| Firefox/WebKit E2E    | Post-MVP           | Extend Playwright matrix once WebCodecs support improves           |
