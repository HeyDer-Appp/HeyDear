import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const demo = (f) => fileURLToPath(new URL(`./src/demo/${f}`, import.meta.url));

// `npm run demo` swaps Firebase for an in-memory copy with sample data (no project needed).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5190 },
  resolve: {
    alias: mode === 'demo'
      ? { 'firebase/app': demo('fakeApp.js'), 'firebase/auth': demo('fakeAuth.js'), 'firebase/firestore': demo('fakeFirestore.js') }
      : {},
  },
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
}));
