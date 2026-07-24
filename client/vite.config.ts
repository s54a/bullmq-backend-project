import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: true,
    port: 3000,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/v1": { target: "http://localhost:5000", changeOrigin: true },
      "/admin": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
