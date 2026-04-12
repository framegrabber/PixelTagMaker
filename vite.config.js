import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/PixelTagMaker/' : '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['manifold-3d']
  }
})
