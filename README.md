# Video Render SDK

![Video Render SDK Logo](docs/assets/logo.png)

A TypeScript-first monorepo SDK providing a unified, hardware-agnostic video rendering pipeline.

## Overview

The Video Render SDK is designed to handle complex video rendering tasks across different environments (browser and server) while maintaining a consistent schema and event system. It abstracts the underlying rendering technologies (FFmpeg.wasm, WebCodecs, Fluent-FFmpeg) into a cohesive API.

## Packages

This monorepo consists of three main packages:

### 1. `@vrs/core`

- **Path:** `packages/core`
- **Description:** The heart of the SDK. It contains shared Zod schemas, hardware assessment logic, and the event emitter system.
- **Key Features:**
  - Unified `RenderStatus` and `RenderEvent` types.
  - Hardware capability detection.
  - Decision logic for switching between render strategies.

### 2. `@vrs/client`

- **Path:** `packages/client`
- **Description:** The browser-side renderer implementation.
- **Key Features:**
  - Utilizes `FFmpeg.wasm` and `WebCodecs` for in-browser rendering.
  - Optimized for client-side performance.
  - Seamless integration with `@vrs/core`.

### 3. `@vrs/server`

- **Path:** `packages/server`
- **Description:** The server-side renderer implementation.
- **Key Features:**
  - Built on Node.js, Express, and `fluent-ffmpeg`.
  - Provides an HTTP API for rendering jobs.
  - Supports Server-Sent Events (SSE) for progress updates.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- FFmpeg (System binary >= 6.0.0) required for `@vrs/server`

### Installation

Install dependencies from the root directory:

```bash
npm install
```

### Building

Build all packages using Turbo:

```bash
npm run build
```

### Running Tests

Run unit tests across all packages:

```bash
npm test
```

### Development

Start the development server/watch mode:

```bash
npm run dev
```

## Contributing

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. When making changes, please include a changeset to document your modifications.

```bash
npx changeset
```
