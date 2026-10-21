import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  root: fileURLToPath(new URL(".", import.meta.url)),
  build: {
    rollupOptions: {
      input: {
        student: resolve(fileURLToPath(new URL(".", import.meta.url)), "index.html"),
        admin: resolve(fileURLToPath(new URL(".", import.meta.url)), "admin.html")
      }
    },
    outDir: fileURLToPath(new URL("../public/student", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets"
  }
});