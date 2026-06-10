import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'SdsNg',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Externalize all node_modules — consumers install their own copies
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('@/'),
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'react/jsx-runtime',
        },
      },
    },
    // Emit sourcemaps for easier debugging in consuming projects
    sourcemap: true,
  },
})
