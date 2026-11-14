import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
