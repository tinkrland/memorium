import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react" }),
    tailwindcss(),
    react(),
  ],
  server: {
    port: 3001,
    proxy: {
      "/api": "http://localhost:3000",
      "/webhooks": "http://localhost:3000"
    }
  }
});
