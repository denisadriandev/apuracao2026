import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    // Mantém o JS num único chunk: o painel é uma aplicação só, sem rotas
    chunkSizeWarningLimit: 600,
  },
});
