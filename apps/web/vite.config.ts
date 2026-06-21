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

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'util', 'events', 'path'],
      globals: { Buffer: true, process: true },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: [
      // most specific first — the SDK's ZgFile reaches for fs/promises in Node paths
      { find: 'node:fs/promises', replacement: fsPromisesStub },
      { find: 'node:fs', replacement: fsStub },
      { find: /^fs$/, replacement: fsStub },
    ],
  },
  build: { target: 'esnext' },
})
