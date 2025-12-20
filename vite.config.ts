import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: env.AGENT_URL || env.VITE_AGENT_URL || 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => {
                  if (path.startsWith('/api/crewai/chat')) return '/crewai-chat';
                  if (path.startsWith('/api/crewai/agent')) return '/crewai-agent';
                  if (path.startsWith('/api/crewai/workflow')) return path.replace(/^\/api\/crewai\/workflow/, '/workflow');
                  return path.replace(/^\/api/, '');
                },
                timeout: 1800000,
                proxyTimeout: 1800000,
                configure: (proxy, _options) => {
                  proxy.on('proxyRes', (proxyRes, _req, _res) => {
                    proxyRes.headers['Connection'] = 'keep-alive';
                    proxyRes.headers['Cache-Control'] = 'no-cache, no-transform';
                    proxyRes.headers['X-Accel-Buffering'] = 'no';
                  });
                },
            }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.AGENT_URL': JSON.stringify(env.AGENT_URL || env.VITE_AGENT_URL),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
