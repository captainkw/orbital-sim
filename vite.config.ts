import { defineConfig } from 'vite';

export default defineConfig({
  base: '/orbital-sim/',
  server: {
    port: 3002,
  },
  build: {
    sourcemap: true,
  },
});
