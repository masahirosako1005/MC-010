import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/web' },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001', '/mcp': 'http://127.0.0.1:3001' },
    // Local runtimes, databases, skills and uploads are outside the SPA source.
    watch: { ignored: ['**/.tools/**','**/.local/**','**/.skill-sources/**','**/.agents/**','**/uploads/**','**/docs/**','**/Password*'] },
    fs: { deny: ['.env','.env.*','*.{crt,pem,key,p12,pfx,cer,der}','.npmrc','.yarnrc.yml','**/.git/**','**/Password*','**/uploads/**','**/.tools/**','**/.local/**','**/.skill-sources/**','**/.agents/**'] },
  },
});
