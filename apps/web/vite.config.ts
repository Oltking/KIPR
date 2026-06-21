import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The 0G storage SDK imports Node built-ins (crypto/stream/fs) at module load, so
// the polyfills + fs stubs below are NOT optional in the browser. Config mirrors
// the verified 0g-storage-ts-starter-kit web/vite.config.ts.
const here = path.dirname(fileURLToPath(import.meta.url))
const fsStub = path.resolve(here, 'src/stubs/fs.ts')
const fsPromisesStub = path.resolve(here, 'src/stubs/fs-promises.ts')
const streamPromisesStub = path.resolve(here, 'src/stubs/stream-promises.ts')

// esbuild plugin so the dev-mode dep optimizer also redirects stream/promises
// (the compute SDK does `await import('stream/promises')`, which stream-browserify lacks).
const stubStreamPromisesEsbuild = {
  name: 'kipr-stub-stream-promises',
  setup(build: { onResolve: (opts: { filter: RegExp }, cb: () => { path: string }) => void }) {
    build.onResolve({ filter: /(^|[/:])stream\/promises$|stream-browserify\/promises$/ }, () => ({
      path: streamPromisesStub,
    }))
  },
}

export default defineConfig({
  plugins: [
    // Runs BEFORE node-polyfills: redirect stream/promises (which stream-browserify
    // lacks) to our stub, so the compute SDK bundles for the browser.
    {
      name: 'kipr-stub-node-subpaths',
      enforce: 'pre',
      resolveId(id) {
        if (
          id === 'stream/promises' ||
          id === 'node:stream/promises' ||
          id.endsWith('stream-browserify/promises')
        ) {
          return streamPromisesStub
        }
        return null
      },
    },
    react(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'util', 'events', 'path'],
      globals: { Buffer: true, process: true },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: [
      // most specific first — the SDKs reach for these Node subpaths in non-browser paths
      { find: 'node:fs/promises', replacement: fsPromisesStub },
      { find: 'node:fs', replacement: fsStub },
      { find: /^fs$/, replacement: fsStub },
      { find: 'node:stream/promises', replacement: streamPromisesStub },
      { find: 'stream/promises', replacement: streamPromisesStub },
      { find: 'stream-browserify/promises', replacement: streamPromisesStub },
    ],
  },
  build: { target: 'esnext' },
  optimizeDeps: {
    esbuildOptions: { plugins: [stubStreamPromisesEsbuild] },
  },
})
