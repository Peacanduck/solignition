import { nodePolyfills } from 'vite-plugin-node-polyfills'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'node:path'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills({}),
    react(),
    tailwindcss(),
    viteTsconfigPaths({
      //
      root: resolve(__dirname),
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@project/anchor': path.resolve(__dirname, './clients/js/src'),
    },
  },
  test: {
    globals: true,
  },
  server: {
    port: 5173,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'anita-radiophonic-gametically.ngrok-free.dev', // ngrok tunnel domain for server
      'solignition.ngrok.app', // ngrok tunnel domain for frontend
    ],
  },
})
