import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true, //  fuerza Vite a hacer polling
      interval: 100, //  frecuencia del polling en ms
    },
    port: 5173,
    host: "127.0.0.1",
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
