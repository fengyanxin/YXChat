import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: 'https://open.bigmodel.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api/paas/v4'),
        },
      },
    },
    define: {
      'import.meta.env.VITE_ZHIPU_API_KEY': JSON.stringify(process.env.VITE_ZHIPU_API_KEY),
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || '/api/chat/completions'),
    },
  }
})
