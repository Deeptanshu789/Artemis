import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteStaticCopy } from "vite-plugin-static-copy";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/service-worker.ts"),
        content: resolve(__dirname, "src/content/banner.ts"),
        popup: resolve(__dirname, "src/popup/popup.ts"),
        offscreen: resolve(__dirname, "src/offscreen/offscreen.ts"),
        options: resolve(__dirname, "src/options/options.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    target: "chrome120",
    minify: isProd,
    sourcemap: !isProd,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "public/manifest.json", dest: "." },
        { src: "public/icons", dest: "icons" },
        { src: "src/popup/popup.html", dest: "." },
        { src: "src/popup/popup.css", dest: "." },
        { src: "src/content/banner.css", dest: "." },
        { src: "src/offscreen/offscreen.html", dest: "." },
        { src: "src/options/options.html", dest: "." },
      ],
    }),
  ],
});
