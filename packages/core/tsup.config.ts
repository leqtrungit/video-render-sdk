import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'schema/index': 'src/schema/index.ts',
    'assessment/index': 'src/assessment/index.ts',
    'events/index': 'src/events/index.ts',
    'switcher/index': 'src/switcher/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
});
