import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react()],
    optimizeDeps: {
        include: ['recharts'],
    },
    build: {
        target: 'es2022',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    recharts: ['recharts'],
                    tradingview: ['lightweight-charts'],
                    icons: ['lucide-react'],
                },
            },
        },
    },
    server: {
        port: 5847,
        proxy: {
            '/api': 'http://localhost:3001',
        },
    },
    preview: {
        port: 5847,
    },
});
