import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: fileURLToPath(new URL("./planner_acceptance.entry.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "validator.mjs",
    },
    outDir: fileURLToPath(new URL("../.planner-acceptance", import.meta.url)),
    emptyOutDir: false,
    minify: false,
    target: "node22",
  },
});
