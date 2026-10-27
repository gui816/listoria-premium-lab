import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/listoria-premium-lab/",
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001", "/socket.io": { target: "http://localhost:3001", ws: true } } }
});
