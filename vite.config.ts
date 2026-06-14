import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    fileParallelism: false,
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
  },
})
