import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    // ...,
  ],
  build: {
    // Keep the big, rarely-changing vendor code out of the app chunk so a deploy
    // that only touches app code doesn't bust the vendor cache for returning
    // visitors. Vendor chunks are large but stable and long-cached.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // HARD-WON RULE: React must stay in the SAME chunk as everything that
        // reads the React namespace at module-eval time — notably Mantine, whose
        // `useIsomorphicEffect` evaluates `React.useLayoutEffect` at import time.
        // Isolating React into its own chunk makes that cross-chunk access
        // resolve to undefined and white-screens the app with "Cannot read
        // properties of undefined (reading 'useLayoutEffect')". So we colocate
        // the whole React-dependent UI stack (React + Mantine + TanStack) in one
        // `vendor` chunk and only split out Firebase, which is framework-agnostic
        // and uses named exports (cross-chunk safe). Do NOT split React out.
        // (Algolia stays in the advanced-search route chunk via lazy loading.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('@mantine') ||
            id.includes('@tanstack')
          ) {
            return 'vendor';
          }
        },
      },
    },
  },
})
