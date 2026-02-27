# AGENTS.md

## Setup commands

- Install deps: `npm install`
- Start dev server: `npm run dev`
- Run tests: `npm test`

## Code style

- TypeScript strict mode (enforced via `tsconfig.base.json`)
- Prettier formatting (run `npm run format`)
- ESLint linting (run `npm run lint`)
- Use functional patterns where possible
- ES Modules (`type: "module"`)

## Dev environment tips

- This is a monorepo managed by **Turbo** and **npm**.
- Workspaces are located in the `packages/` directory (e.g., `packages/core`, `packages/client`, `packages/server`).
- Use `npx turbo run <task> --filter <package_name>` to run tasks for a specific package.
  - Example: `npx turbo run build --filter @vrs/core`
- Check `package.json` in each workspace for available scripts and dependencies.

## Testing instructions

- Run all tests from the root: `npm test`
- The project uses **Vitest** for unit testing.
- To focus on a specific package's tests: `npx turbo run test --filter <package_name>`
- Ensure both `npm run lint` and `npm run typecheck` pass before submitting changes.

## PR instructions

- Follow **Conventional Commits** for PR titles (e.g., `feat: ...`, `fix: ...`, `chore: ...`).
- Always run `npm run lint` and `npm test` to ensure CI checks will pass.
