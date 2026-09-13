import {defineConfig} from 'vite'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev'],
  },
  preview: {
    host: true,
  },
})
