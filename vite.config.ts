import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const automaticBase = repository ? `/${repository}/` : "/";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || automaticBase,
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(here, "src") } },
  build: { sourcemap: true },
});
