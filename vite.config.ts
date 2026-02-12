import { defineConfig } from 'vite';

export default defineConfig({
  base: '/orbital-sim/',
  server: {
    port: 3000,
  },
  build: {
    sourcemap: true,
  },
});
