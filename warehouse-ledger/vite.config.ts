import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  root: "client",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5113,
    fs: { allow: [".."] }
  }
});
