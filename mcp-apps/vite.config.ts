import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    host: "127.0.0.1",
    port: 18792,
    strictPort: true,
    proxy: {
      "/v2": "http://127.0.0.1:17281",
      "/openapi.json": "http://127.0.0.1:17281"
    }
  }
});
