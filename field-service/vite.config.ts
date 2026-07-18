import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5237, fs: { allow: [".."] } }
});
