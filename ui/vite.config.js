import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    outDir: 'build'
  },
  define: {
    'import.meta.env.VITE_ACCOUNTS_URL': JSON.stringify(process.env.VITE_ACCOUNTS_URL || ''),
    'import.meta.env.VITE_TRANSFER_URL': JSON.stringify(process.env.VITE_TRANSFER_URL || ''),
    'import.meta.env.VITE_LOAN_URL': JSON.stringify(process.env.VITE_LOAN_URL || ''),
    'import.meta.env.VITE_ATM_URL': JSON.stringify(process.env.VITE_ATM_URL || ''),
    'import.meta.env.VITE_USERS_URL': JSON.stringify(process.env.VITE_USERS_URL || '')
  }
});