import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/dami-posak/',
  plugins: [
    basicSsl()
  ]
})