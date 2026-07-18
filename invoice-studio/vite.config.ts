import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client lives in client/, but shared/ sits one level up, so we widen
// Vite's filesystem allow-list to the project root.
export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5110,
    fs: { allow: [".."] }
  }
});
