import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: 'https://moosic-liart.vercel.app/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers/zod', 'zod'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    sourcemap: true,
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query']
  }
})
