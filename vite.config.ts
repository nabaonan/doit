import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import Components from "unplugin-vue-components/vite";
import { AntdvNextResolver } from "@antdv-next/auto-import-resolver";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    Components({
      resolvers: [AntdvNextResolver()],
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
