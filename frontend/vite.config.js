import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  root: fileURLToPath(new URL(".", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("../public/student", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        igsMaths: fileURLToPath(new URL("./igs-maths.html", import.meta.url))
      }
    }
  }
});