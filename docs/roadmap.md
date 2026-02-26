# Video Render SDK — Build Roadmap

> **Version:** 0.1.0
> **Updated:** 2026-02-25
> **Status:** Planning

---

## 📦 Current State

| Item                                                                           | Status         |
| ------------------------------------------------------------------------------ | -------------- |
| Monorepo setup (Turborepo + npm workspaces)                                    | ✅ Done        |
| Toolchain: TypeScript, ESLint, Prettier, Husky, Vitest, Playwright, Changesets | ✅ Done        |
| Package scaffolding: `@vrs/core`, `@vrs/client`, `@vrs/server`                 | ✅ Done        |
| Source implementation                                                          | ❌ Not started |

---

## Phase 1 — `@vrs/core` Foundation _(Est. 2–3 weeks)_

> **Goal:** Build the shared layer. All other packages depend on this — must be completed first.

### 1.1 Schema (`src/schema/`)

- [x] Define Zod schemas: `VideoProjectSchema`, `TrackSchema`, `EffectSchema`, `OutputSettingsSchema`
- [x] Export inferred TypeScript types: `VideoProject`, `Track`, `Effect`, `OutputSettings`
- [x] Schema versioning — emit clear error if `version` field is unsupported
- [x] Unit tests: valid/invalid parsing, edge cases

### 1.2 Events (`src/events/`)

- [x] `eventemitter3` wrapper
- [x] Event types: `ProgressEvent`, `DecisionEvent`, `ErrorEvent`
- [x] Export `RenderEventEmitter` base class

### 1.3 Hardware Assessment (`src/assessment/`)

- [ ] `assessClientTier()` — reads `navigator.hardwareConcurrency`, `navigator.deviceMemory`, WebGL renderer string
- [ ] `assessServerCapacity()` — HTTP `GET /health` wrapper
- [ ] Tier thresholds (configurable): `low | medium | high`
- [ ] Unit tests with mocked `navigator.*`

### 1.4 Auto-Switch Logic (`src/switcher/`)

- [ ] `decideRenderMode(clientTier, serverCapacity, options)` → `'local' | 'remote'`
- [ ] Emit `DecisionEvent` with reason string for full transparency
- [ ] Unit tests covering all decision branches

### 1.5 Unified API Shell

- [ ] `VideoRenderSDK` class: constructor accepts `mode`, `serverUrl`, `renderers`, `logLevel`
- [ ] `.render(project)` → returns `RenderJob`
- [ ] `RenderJob`: `.on('progress')`, `.result()`, `.cancel()`

**Deliverable:** `@vrs/core` fully tested, ≥ 90% line coverage, publishable as standalone package.

---

## Phase 2 — `@vrs/server` _(Est. 2–3 weeks)_

> **Goal:** Server-side rendering. Easier than client (no WASM), validates API contract early.

### 2.1 HTTP API (`src/api/`)

- [ ] `POST /jobs` — validate `VideoProject` with Zod, return `{ jobId }`
- [ ] `GET /jobs/:id` — return job status
- [ ] `DELETE /jobs/:id` — cancel job
- [ ] `GET /health` — return `{ load, availableSlots, cpuPercent }`
- [ ] Error handling middleware, CORS

### 2.2 Job Queue (`src/queue/`)

- [ ] In-memory `Map<jobId, Job>` with async FIFO runner
- [ ] Job states: `queued | rendering | done | failed | cancelled`
- [ ] Configurable concurrency limit (default: 2)

### 2.3 FFmpeg Renderer (`src/renderer/`)

- [ ] `ProjectToFfmpegCommand`: convert `VideoProject` → `fluent-ffmpeg` filter_complex graph
- [ ] Support: video clip, image overlay, audio track, text, fade effect
- [ ] Emit progress events from FFmpeg stdout

### 2.4 SSE Progress (`src/sse/`)

- [ ] `GET /jobs/:id/progress` → SSE stream (`{ percent, status, message }`)
- [ ] `GET /jobs/:id/download` → serve rendered output file
- [ ] Temp file cleanup after download

### 2.5 Integration Tests

- [ ] Supertest for all REST endpoints
- [ ] Fixture: 1-second, 10-frame synthetic video asset

**Deliverable:** Server render pipeline working end-to-end with real FFmpeg.

---

## Phase 3 — `@vrs/client` _(Est. 3–4 weeks)_

> **Goal:** Browser-side rendering. Most complex due to WASM + Web Workers.

> [!IMPORTANT]
> The host app **must** set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers for `SharedArrayBuffer` (required by FFmpeg.wasm multi-thread). Test this early.

### 3.1 Asset Loader (`src/loader/`)

- [ ] Fetch assets from URL → `ArrayBuffer`
- [ ] WebCodecs decoder (`VideoDecoder`, `AudioDecoder`)
- [ ] Fallback: `<HTMLVideoElement>` frame extraction when WebCodecs unavailable
- [ ] Cache layer: `Cache API` or `Map<url, ArrayBuffer>`

### 3.2 Compositor (`src/compositor/`)

- [ ] `OffscreenCanvas` Web Worker pipeline (keeps main thread free)
- [ ] Per-frame: apply `Transform` (x, y, scale, rotation, opacity)
- [ ] Built-in effects: `fade`, `blur`
- [ ] Layer ordering by track sequence

### 3.3 FFmpeg.wasm Encoder (`src/encoder/`)

- [ ] Setup `@ffmpeg/ffmpeg` + `@ffmpeg/core-mt` (multi-threaded WASM)
- [ ] Pipe composited frames → FFmpeg.wasm encoder
- [ ] Output: `Uint8Array` → downloadable `Blob`
- [ ] Emit progress events

### 3.4 `ClientRenderer` Class

- [ ] Implement shared renderer interface from `@vrs/core`
- [ ] Wire: loader → compositor → encoder
- [ ] `.render(project)` → `RenderJob`

### 3.5 Integration Tests

- [ ] Vitest + `happy-dom` environment
- [ ] Mock `@ffmpeg/ffmpeg` at module boundary (no real WASM in tests)
- [ ] Test: progress events, cancellation flow

**Deliverable:** Client render pipeline working end-to-end in a real browser tab.

---

## Phase 4 — Integration, E2E & Polish _(Est. 2 weeks)_

> **Goal:** Wire everything together, validate full pipeline, prepare for publish.

### 4.1 E2E Tests (Playwright)

- [ ] Test harness HTML page importing `@vrs/client`
- [ ] Start `@vrs/server` on a random port before suite

| Scenario               | Mode     | Expected                                     |
| ---------------------- | -------- | -------------------------------------------- |
| Happy path (local)     | `local`  | Render completes, blob URL returned          |
| Happy path (remote)    | `remote` | Job submitted, SSE 0→100%, file downloadable |
| Auto: high-tier client | `auto`   | Routes to local                              |
| Auto: low-tier client  | `auto`   | Routes to remote                             |
| Server at capacity     | `auto`   | Fallback to local with `DecisionEvent`       |
| Cancel in-flight job   | `remote` | Job status becomes `cancelled`               |

### 4.2 Conformance Tests

- [ ] Reference fixtures in `fixtures/conformance/`: text overlay, fade, audio track
- [ ] Run each fixture through both `ClientRenderer` and `ServerRenderer`
- [ ] Extract sample frames, compute PSNR + SSIM
- [ ] CI gate: assert PSNR ≥ 40 dB (< 1% variance requirement from PRD)

### 4.3 CI/CD

- [ ] GitHub Actions pipeline: typecheck → unit tests → coverage gate (≥90%) → E2E → conformance
- [ ] Changesets release workflow for per-package semantic versioning

### 4.4 Examples & Documentation

- [ ] `packages/*/examples/` — plain HTML + TypeScript, runnable via `vite`
- [ ] TypeDoc from TSDoc comments
- [ ] `README.md` quick-start (target: first render < 30 minutes)

---

## 🔢 Dependency Order

```
@vrs/core  (schema + events + assessment + switcher)
    ↓
@vrs/server  (validate full pipeline early, no WASM)
    ↓
@vrs/client  (most complex, depends on stable schema)
    ↓
Integration + E2E + Conformance
```

---

## ⚠️ Key Risks

| Risk                                           | Mitigation                                            |
| ---------------------------------------------- | ----------------------------------------------------- |
| COOP/COEP headers blocking `SharedArrayBuffer` | Test header setup in Phase 3 day 1                    |
| FFmpeg.wasm thread performance in browser      | Benchmark early; have fallback single-thread mode     |
| Client vs server output divergence > 1%        | Conformance tests as CI gate before publish           |
| FFmpeg binary not installed on CI              | Document as peer requirement; install via `apt` in CI |

---

## 🚀 Post-MVP (Out of Scope for Now)

- Plugin sandboxing (`MessageChannel` / Compartment API)
- BullMQ + Redis job queue for production persistence
- Distributed rendering across multiple server workers
- Firefox/WebKit E2E (pending WebCodecs support)
- Native mobile (iOS/Android)
- Cloud SaaS tier
