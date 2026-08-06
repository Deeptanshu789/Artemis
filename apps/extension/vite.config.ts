import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import { viteStaticCopy } from "vite-plugin-static-copy";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, resolve(__dirname, "../.."), "");
  const localEnv = loadEnv(mode, resolve(__dirname, "../dashboard"), "");
  const env = { ...rootEnv, ...localEnv };

  return {
    define: {
      __ARTEMIS_DEFAULTS__: JSON.stringify({
        apiHttp: env.VITE_API_BASE || "http://localhost:3001",
        apiWs: (env.VITE_API_BASE || "http://localhost:3001").replace(/^http/, "ws") + "/ws/audio",
        dashboardUrl: env.DASHBOARD_URL || "http://localhost:5173",
        supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL || "",
        supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "",
      }),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      // Prevent Vite from injecting document/window modulepreload helpers into the SW
      modulePreload: false,
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
          manualChunks(id) {
            if (id.includes("node_modules/@supabase")) {
              return "supabase";
            }
            return undefined;
          },
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
  };
});
